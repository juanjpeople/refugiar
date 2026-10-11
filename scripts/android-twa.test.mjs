// La app de Android abre la web a pantalla completa solo si las dos mitades coinciden: lo que
// declara la app (android/app/build.gradle) y lo que publica la web (assetlinks.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const gradle = read("android/app/build.gradle");
const links = JSON.parse(read("public/.well-known/assetlinks.json"));
const wrangler = read("wrangler.jsonc");

test("assetlinks.json habilita esta app para abrir links", () => {
  const applicationId = gradle.match(/applicationId "([^"]+)"/)?.[1];
  assert.equal(links.length, 1);
  const [statement] = links;
  assert.deepEqual(statement.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(statement.target.namespace, "android_app");
  assert.equal(statement.target.package_name, applicationId);
  assert.ok(statement.target.sha256_cert_fingerprints.length > 0);
  for (const fingerprint of statement.target.sha256_cert_fingerprints) {
    assert.match(fingerprint, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  }
});

test("la app abre el mismo origen donde se publica la web", () => {
  const host = gradle.match(/def appHost = '([^']+)'/)?.[1];
  const origin = wrangler.match(/"APP_ORIGIN": "([^"]+)"/)?.[1];
  assert.equal(`https://${host}`, origin);
});
