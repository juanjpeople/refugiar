import { parseShareFragment } from "./service";
const KEY = "refugiar-import-intent";
export function rememberImport(fragment: string) {
  parseShareFragment(fragment);
  sessionStorage.setItem(KEY, JSON.stringify({ fragment, at: Date.now() }));
}
export function forgetImport() {
  sessionStorage.removeItem(KEY);
}
export function pendingImportHref(): string | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!raw || Date.now() - raw.at > 86400000) {
      forgetImport();
      return null;
    }
    parseShareFragment(raw.fragment);
    return `/compartido${raw.fragment.startsWith("#") ? raw.fragment : `#${raw.fragment}`}`;
  } catch {
    return null;
  }
}
