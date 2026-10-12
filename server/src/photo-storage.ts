export class PhotoStorageError extends Error {
  readonly operation: "upload" | "download" | "delete" | "configure";
  readonly status: number;

  constructor(operation: "upload" | "download" | "delete" | "configure", status: number) {
    super(`photo storage ${operation} failed (${status})`);
    this.name = "PhotoStorageError";
    this.operation = operation;
    this.status = status;
  }
}

export interface PhotoStorage {
  put(key: string, body: ArrayBuffer): Promise<void>;
  get(key: string): Promise<Response | null>;
  delete(keys: string[]): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

interface PhotoStorageEnv {
  APP_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_PHOTOS_BUCKET: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PHOTO_STORAGE?: string;
  LOCAL_PHOTOS?: R2Bucket;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export class SupabasePhotoStorage implements PhotoStorage {
  private readonly baseUrl: string;
  private readonly serviceKey: string;
  private readonly bucket: string;
  private readonly fetcher: typeof fetch;

  constructor(projectUrl: string, serviceKey: string, bucket: string, fetcher: typeof fetch = fetch) {
    if (!projectUrl || !serviceKey || !bucket) throw new PhotoStorageError("configure", 500);
    this.baseUrl = projectUrl.replace(/\/+$/, "");
    this.serviceKey = serviceKey;
    this.bucket = bucket;
    this.fetcher = fetcher;
  }

  private headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
    };
  }

  private objectUrl(key: string) {
    return `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodePath(key)}`;
  }

  async put(key: string, body: ArrayBuffer) {
    const response = await this.fetcher(this.objectUrl(key), {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body,
    });
    if (!response.ok) throw new PhotoStorageError("upload", response.status);
  }

  async get(key: string) {
    const response = await this.fetcher(this.objectUrl(key), { headers: this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) throw new PhotoStorageError("download", response.status);
    return response;
  }

  async delete(keys: string[]) {
    const response = await this.fetcher(`${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}`, {
      method: "DELETE",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!response.ok) throw new PhotoStorageError("delete", response.status);
  }

  private async listFiles(prefix: string): Promise<string[]> {
    const files: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const listed = await this.fetcher(`${this.baseUrl}/storage/v1/object/list/${encodeURIComponent(this.bucket)}`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!listed.ok) throw new PhotoStorageError("delete", listed.status);
      const entries = (await listed.json()) as { id?: string | null; name?: string }[];
      for (const entry of entries) {
        if (!entry.name) continue;
        const path = `${prefix}/${entry.name}`;
        if (entry.id) files.push(path);
        else files.push(...(await this.listFiles(path)));
      }
      if (entries.length < 100) return files;
    }
  }

  async deletePrefix(prefix: string) {
    const normalized = prefix.replace(/^\/+|\/+$/g, "");
    const keys = await this.listFiles(normalized);
    for (let index = 0; index < keys.length; index += 100) {
      await this.delete(keys.slice(index, index + 100));
    }
  }
}

const localPhotos = new Map<string, Uint8Array>();

/** Solo para el emulador local de Wrangler. Guarda bytes ya cifrados en disco. */
export class LocalR2PhotoStorage implements PhotoStorage {
  private readonly bucket: R2Bucket;
  constructor(bucket: R2Bucket) { this.bucket = bucket; }

  async put(key: string, body: ArrayBuffer) {
    try {
      const stored = await this.bucket.put(key, body, { httpMetadata: { contentType: "application/octet-stream" } });
      if (!stored) throw new Error("not stored");
    } catch { throw new PhotoStorageError("upload", 500); }
  }

  async get(key: string) {
    try {
      const object = await this.bucket.get(key);
      return object ? new Response(object.body, { headers: { "Content-Type": "application/octet-stream" } }) : null;
    } catch { throw new PhotoStorageError("download", 500); }
  }

  async delete(keys: string[]) {
    try {
      for (let offset = 0; offset < keys.length; offset += 100) await this.bucket.delete(keys.slice(offset, offset + 100));
    } catch { throw new PhotoStorageError("delete", 500); }
  }

  async deletePrefix(prefix: string) {
    const normalized = prefix.replace(/^\/+|\/+$/g, "");
    if (!normalized) throw new PhotoStorageError("delete", 400);
    try {
      for (;;) {
        // Volver a la primera página después de borrar: un cursor calculado antes
        // del borrado puede saltarse objetos. La barra evita afectar casas vecinas.
        const page = await this.bucket.list({ prefix: `${normalized}/`, limit: 100 });
        if (page.objects.length === 0) return;
        await this.delete(page.objects.map((object) => object.key));
        if (!page.truncated) return;
      }
    } catch { throw new PhotoStorageError("delete", 500); }
  }
}

const localPhotoStorage: PhotoStorage = {
  async put(key, body) {
    localPhotos.set(key, new Uint8Array(body).slice());
  },
  async get(key) {
    const body = localPhotos.get(key);
    return body ? new Response(body.slice(), { headers: { "Content-Type": "application/octet-stream" } }) : null;
  },
  async delete(keys) {
    for (const key of keys) localPhotos.delete(key);
  },
  async deletePrefix(prefix) {
    for (const key of localPhotos.keys()) {
      if (key.startsWith(`${prefix.replace(/\/+$/, "")}/`)) localPhotos.delete(key);
    }
  },
};

export function photoStorage(env: PhotoStorageEnv): PhotoStorage {
  if (env.PHOTO_STORAGE === "local-r2") {
    const origin = new URL(env.APP_ORIGIN);
    if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || !env.LOCAL_PHOTOS) {
      throw new PhotoStorageError("configure", 500);
    }
    return new LocalR2PhotoStorage(env.LOCAL_PHOTOS);
  }
  // Servidor de casa (`npm run casa`): fotos cifradas en el disco del equipo, en cualquier
  // dirección de la red local. Producción no tiene el binding LOCAL_PHOTOS.
  if (env.PHOTO_STORAGE === "home") {
    if (!env.LOCAL_PHOTOS) throw new PhotoStorageError("configure", 500);
    return new LocalR2PhotoStorage(env.LOCAL_PHOTOS);
  }
  if (env.PHOTO_STORAGE === "memory") {
    const hostname = new URL(env.APP_ORIGIN).hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") throw new PhotoStorageError("configure", 500);
    return localPhotoStorage;
  }
  if (env.PHOTO_STORAGE && env.PHOTO_STORAGE !== "supabase") throw new PhotoStorageError("configure", 500);
  return new SupabasePhotoStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_PHOTOS_BUCKET);
}
