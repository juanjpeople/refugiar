// Refugiar: prototipo de base local ESP32.
//
// Un relevo de mensajes ya cifrados dentro de la casa: los teléfonos dejan cambios y los otros
// los levantan, sin internet. El ESP nunca ve claves de la casa ni contenido legible; solo guarda
// bytes opacos, con un límite de espacio, y es reemplazable: si se pierde, los datos siguen en
// los teléfonos. Ver README.md y docs/CIMIENTOS_MVP.md (F07).
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <esp_system.h>
#include <mbedtls/md.h>

static const char* VERSION = "0.1.0";
static const uint8_t MAX_DEVICES = 8;
static const uint32_t PAIRING_WINDOW_MS = 10UL * 60UL * 1000UL;
static const uint8_t MAX_PAIR_ATTEMPTS = 5;
static const size_t MAX_MESSAGE = 16384;      // caracteres base64 por mensaje
static const uint32_t MAX_PER_SPACE = 1000;   // mensajes por espacio antes de descartar los más viejos
static const uint8_t MAX_SPACES = 16;
static const float FS_HIGH_WATER = 0.85f;     // por encima de esto se descartan los más viejos
static const uint8_t MAX_ITEMS_PER_READ = 8;

WebServer server(80);
Preferences prefs;

struct Device {
  char id[9];
  uint8_t token[32];
  uint64_t nonce;  // último nonce aceptado (milisegundos del reloj del cliente)
  bool used;
};
Device devices[MAX_DEVICES];
uint64_t savedNonce[MAX_DEVICES];

char pairingCode[7];
uint32_t pairingOpenedAt = 0;
bool pairingOpen = false;
uint8_t pairAttempts = 0;
uint32_t lastNonceSave = 0;
uint32_t lastReconnect = 0;

// ---------- utilidades ----------

void toHex(const uint8_t* data, size_t len, char* out) {
  static const char* digits = "0123456789abcdef";
  for (size_t i = 0; i < len; i++) {
    out[i * 2] = digits[data[i] >> 4];
    out[i * 2 + 1] = digits[data[i] & 0x0f];
  }
  out[len * 2] = 0;
}

bool fromHex(const String& hex, uint8_t* out, size_t len) {
  if (hex.length() != len * 2) return false;
  for (size_t i = 0; i < len; i++) {
    char hi = hex[i * 2], lo = hex[i * 2 + 1];
    auto val = [](char c) -> int {
      if (c >= '0' && c <= '9') return c - '0';
      if (c >= 'a' && c <= 'f') return c - 'a' + 10;
      return -1;
    };
    int h = val(hi), l = val(lo);
    if (h < 0 || l < 0) return false;
    out[i] = (uint8_t)((h << 4) | l);
  }
  return true;
}

bool sameBytes(const uint8_t* a, const uint8_t* b, size_t len) {
  uint8_t diff = 0;
  for (size_t i = 0; i < len; i++) diff |= a[i] ^ b[i];
  return diff == 0;
}

bool validSpace(const String& space) {
  if (space.length() < 8 || space.length() > 32) return false;  // nombres cortos para LittleFS
  for (size_t i = 0; i < space.length(); i++) {
    char c = space[i];
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
  }
  return true;
}

void sendJson(int status, const String& body) {
  server.sendHeader("Cache-Control", "no-store");
  server.send(status, "application/json", body);
}

void sendError(int status, const char* code) {
  sendJson(status, String("{\"error\":\"") + code + "\"}");
}

// ---------- dispositivos emparejados ----------

void loadDevices() {
  for (uint8_t i = 0; i < MAX_DEVICES; i++) {
    String key = String("d") + i;
    devices[i].used = prefs.getBytesLength((key + "t").c_str()) == 32;
    if (!devices[i].used) continue;
    prefs.getBytes((key + "t").c_str(), devices[i].token, 32);
    String id = prefs.getString((key + "i").c_str(), "");
    strncpy(devices[i].id, id.c_str(), 8);
    devices[i].id[8] = 0;
    devices[i].nonce = prefs.getULong64((key + "n").c_str(), 0);
    savedNonce[i] = devices[i].nonce;
  }
}

uint8_t deviceCount() {
  uint8_t n = 0;
  for (uint8_t i = 0; i < MAX_DEVICES; i++) n += devices[i].used ? 1 : 0;
  return n;
}

// Guardar nonces de vez en cuando, no en cada pedido: protege la flash. Tras un corte de luz,
// la ventana de repetición queda acotada a lo que pasó desde el último guardado.
void saveNonces(bool force) {
  if (!force && millis() - lastNonceSave < 60000) return;
  lastNonceSave = millis();
  for (uint8_t i = 0; i < MAX_DEVICES; i++) {
    if (!devices[i].used || devices[i].nonce == savedNonce[i]) continue;
    prefs.putULong64((String("d") + i + "n").c_str(), devices[i].nonce);
    savedNonce[i] = devices[i].nonce;
  }
}

void openPairing() {
  uint32_t value = esp_random() % 1000000;
  snprintf(pairingCode, sizeof(pairingCode), "%06lu", (unsigned long)value);
  pairingOpenedAt = millis();
  pairingOpen = true;
  pairAttempts = 0;
  Serial.printf("\nCódigo para emparejar: %s (vale 10 minutos)\n", pairingCode);
}

bool pairingActive() {
  if (pairingOpen && millis() - pairingOpenedAt > PAIRING_WINDOW_MS) {
    pairingOpen = false;
    Serial.println("Emparejamiento cerrado. Escribí 'codigo' para abrirlo de nuevo.");
  }
  return pairingOpen;
}

// Firma: HMAC-SHA256(token, método \n ruta con parámetros \n nonce \n cuerpo), en hex.
int authorize() {
  String id = server.header("X-Device");
  String nonceText = server.header("X-Nonce");
  String sig = server.header("X-Signature");
  int index = -1;
  for (uint8_t i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].used && id == devices[i].id) { index = i; break; }
  }
  uint8_t expected[32], given[32];
  if (index < 0 || nonceText.length() == 0 || nonceText.length() > 19 || !fromHex(sig, given, 32)) return -1;
  uint64_t nonce = strtoull(nonceText.c_str(), nullptr, 10);
  if (nonce <= devices[index].nonce) return -1;

  String uri = server.uri();
  if (server.args() > 0) {
    String query;
    for (int i = 0; i < server.args(); i++) {
      if (server.argName(i) == "plain") continue;
      query += String(query.length() ? "&" : "?") + server.argName(i) + "=" + server.arg(i);
    }
    uri += query;
  }
  String method = server.method() == HTTP_POST ? "POST" : "GET";
  String message = method + "\n" + uri + "\n" + nonceText + "\n" + (server.hasArg("plain") ? server.arg("plain") : String(""));
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (mbedtls_md_hmac(info, devices[index].token, 32, (const uint8_t*)message.c_str(), message.length(), expected) != 0) return -1;
  if (!sameBytes(expected, given, 32)) return -1;
  devices[index].nonce = nonce;
  saveNonces(false);
  return index;
}

// ---------- almacenamiento de mensajes ----------

struct SpaceMeta { uint32_t first; uint32_t last; };  // first = más viejo guardado; last = último asignado

String spaceDir(const String& space) { return "/r/" + space; }

SpaceMeta readMeta(const String& space) {
  SpaceMeta meta = {1, 0};
  File file = LittleFS.open(spaceDir(space) + "/meta", "r");
  if (file) {
    file.read((uint8_t*)&meta, sizeof(meta));
    file.close();
  }
  return meta;
}

void writeMeta(const String& space, const SpaceMeta& meta) {
  File file = LittleFS.open(spaceDir(space) + "/meta", "w");
  file.write((const uint8_t*)&meta, sizeof(meta));
  file.close();
}

uint8_t spaceCount() {
  uint8_t n = 0;
  File dir = LittleFS.open("/r");
  if (!dir) return 0;
  for (File entry = dir.openNextFile(); entry; entry = dir.openNextFile()) n += entry.isDirectory() ? 1 : 0;
  return n;
}

bool fsFull() {
  return (float)LittleFS.usedBytes() > (float)LittleFS.totalBytes() * FS_HIGH_WATER;
}

void dropOldest(const String& space, SpaceMeta& meta) {
  LittleFS.remove(spaceDir(space) + "/" + meta.first);
  meta.first++;
}

void handlePush() {
  if (authorize() < 0) return sendError(401, "firma");
  String space = server.arg("space");
  if (!validSpace(space)) return sendError(400, "espacio");
  String body = server.arg("plain");
  if (body.length() == 0 || body.length() > MAX_MESSAGE) return sendError(413, "tamano");
  for (size_t i = 0; i < body.length(); i++) {
    char c = body[i];
    if (!isalnum((unsigned char)c) && c != '+' && c != '/' && c != '=' && c != '-' && c != '_') return sendError(400, "base64");
  }
  if (!LittleFS.exists(spaceDir(space))) {
    if (spaceCount() >= MAX_SPACES) return sendError(507, "espacios");
    LittleFS.mkdir(spaceDir(space));
  }
  SpaceMeta meta = readMeta(space);
  while (meta.last >= meta.first && (meta.last - meta.first + 1 >= MAX_PER_SPACE || fsFull())) dropOldest(space, meta);
  if (fsFull()) return sendError(507, "lleno");
  uint32_t seq = meta.last + 1;
  File file = LittleFS.open(spaceDir(space) + "/" + seq, "w");
  if (!file || file.print(body) != body.length()) {
    if (file) file.close();
    return sendError(507, "escritura");
  }
  file.close();
  meta.last = seq;
  writeMeta(space, meta);
  sendJson(200, String("{\"seq\":") + seq + ",\"oldest\":" + meta.first + "}");
}

void handlePull() {
  if (authorize() < 0) return sendError(401, "firma");
  String space = server.arg("space");
  if (!validSpace(space)) return sendError(400, "espacio");
  uint32_t after = strtoul(server.arg("after").c_str(), nullptr, 10);
  SpaceMeta meta = readMeta(space);
  // oldest > after + 1 significa que se descartaron mensajes que este cliente no vio: debe resincronizar.
  String out = String("{\"oldest\":") + meta.first + ",\"last\":" + meta.last + ",\"items\":[";
  uint8_t count = 0;
  // Tope de memoria: sin PSRAM, el ESP32 tiene poco heap. El cliente sigue pidiendo con after.
  for (uint32_t seq = max(after + 1, meta.first); seq <= meta.last && count < MAX_ITEMS_PER_READ && out.length() < 40000; seq++) {
    File file = LittleFS.open(spaceDir(space) + "/" + seq, "r");
    if (!file) continue;
    out += String(count ? "," : "") + "{\"seq\":" + seq + ",\"data\":\"" + file.readString() + "\"}";
    file.close();
    count++;
  }
  out += "]}";
  sendJson(200, out);
}

// ---------- información y emparejamiento ----------

String infoJson() {
  return String("{\"app\":\"refugiar-relay\",\"version\":\"") + VERSION +
    "\",\"chip\":\"" + ESP.getChipModel() + "\",\"revision\":" + ESP.getChipRevision() +
    ",\"cores\":" + ESP.getChipCores() + ",\"flash\":" + ESP.getFlashChipSize() +
    ",\"psram\":" + ESP.getPsramSize() + ",\"heapFree\":" + ESP.getFreeHeap() +
    ",\"heapMin\":" + ESP.getMinFreeHeap() + ",\"fsTotal\":" + LittleFS.totalBytes() +
    ",\"fsUsed\":" + LittleFS.usedBytes() + ",\"devices\":" + deviceCount() +
    ",\"pairing\":" + (pairingActive() ? "true" : "false") + ",\"uptime\":" + (millis() / 1000) + "}";
}

void handleInfo() { sendJson(200, infoJson()); }

void handlePair() {
  if (!pairingActive()) return sendError(403, "cerrado");
  String code = server.arg("code");
  if (code.length() != 6 || !sameBytes((const uint8_t*)code.c_str(), (const uint8_t*)pairingCode, 6)) {
    if (++pairAttempts >= MAX_PAIR_ATTEMPTS) {
      pairingOpen = false;
      Serial.println("Demasiados intentos: emparejamiento cerrado.");
    }
    return sendError(401, "codigo");
  }
  int slot = -1;
  for (uint8_t i = 0; i < MAX_DEVICES; i++) if (!devices[i].used) { slot = i; break; }
  if (slot < 0) return sendError(507, "dispositivos");
  uint8_t idBytes[4];
  esp_fill_random(idBytes, sizeof(idBytes));
  esp_fill_random(devices[slot].token, 32);
  toHex(idBytes, 4, devices[slot].id);
  devices[slot].nonce = 0;
  devices[slot].used = true;
  savedNonce[slot] = 0;
  String key = String("d") + slot;
  prefs.putBytes((key + "t").c_str(), devices[slot].token, 32);
  prefs.putString((key + "i").c_str(), devices[slot].id);
  prefs.putULong64((key + "n").c_str(), 0);
  char token[65];
  toHex(devices[slot].token, 32, token);
  Serial.printf("Dispositivo emparejado: %s\n", devices[slot].id);
  sendJson(200, String("{\"device\":\"") + devices[slot].id + "\",\"token\":\"" + token + "\"}");
}

// ---------- consola serie ----------

String readLine(const char* prompt) {
  Serial.print(prompt);
  String line;
  while (true) {
    while (!Serial.available()) delay(10);
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') break;
    line += c;
  }
  Serial.println();
  line.trim();
  return line;
}

void askWifi() {
  String ssid = readLine("Nombre del Wi-Fi: ");
  String pass = readLine("Clave del Wi-Fi: ");
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
}

void factoryReset() {
  saveNonces(true);
  prefs.clear();
  LittleFS.format();
  Serial.println("Borrado completo. Reiniciando.");
  delay(500);
  ESP.restart();
}

void handleSerial() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd == "info") Serial.println(infoJson());
  else if (cmd == "codigo") openPairing();
  else if (cmd == "wifi") { askWifi(); ESP.restart(); }
  else if (cmd == "borrar") factoryReset();
  else if (cmd.length()) Serial.println("Comandos: info, codigo, wifi, borrar");
}

// ---------- arranque ----------

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.printf("\nRefugiar base local %s\n", VERSION);
  if (!LittleFS.begin(true)) Serial.println("No se pudo montar LittleFS.");
  prefs.begin("refugiar", false);
  loadDevices();

  if (prefs.getString("ssid", "").length() == 0) askWifi();
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("refugiar");
  while (true) {
    WiFi.begin(prefs.getString("ssid", "").c_str(), prefs.getString("pass", "").c_str());
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) delay(250);
    if (WiFi.status() == WL_CONNECTED) break;
    Serial.println("No se pudo conectar al Wi-Fi.");
    askWifi();
  }
  MDNS.begin("refugiar");
  MDNS.addService("http", "tcp", 80);

  const char* headers[] = {"X-Device", "X-Nonce", "X-Signature"};
  server.collectHeaders(headers, 3);
  server.on("/info", HTTP_GET, handleInfo);
  server.on("/pair", HTTP_POST, handlePair);
  server.on("/relay", HTTP_POST, handlePush);
  server.on("/relay", HTTP_GET, handlePull);
  server.onNotFound([]() { sendError(404, "ruta"); });
  server.begin();

  Serial.printf("Listo en http://%s (o http://refugiar.local)\n", WiFi.localIP().toString().c_str());
  Serial.println(infoJson());
  openPairing();
}

void loop() {
  server.handleClient();
  handleSerial();
  pairingActive();
  saveNonces(false);
  if (WiFi.status() != WL_CONNECTED && millis() - lastReconnect > 10000) {
    lastReconnect = millis();
    WiFi.reconnect();
  }
  delay(2);
}
