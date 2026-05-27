type StorageKind = "local" | "session";

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGet(storage: Storage | null, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
    return !!storage;
  } catch {
    return false;
  }
}

function safeRemove(storage: Storage | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be blocked in private or hardened browser modes.
  }
}

export function createSupabaseAuthStorage() {
  return {
    getItem(key: string) {
      return safeGet(getStorage("local"), key) ?? safeGet(getStorage("session"), key);
    },
    setItem(key: string, value: string) {
      if (safeSet(getStorage("local"), key, value)) {
        safeRemove(getStorage("session"), key);
        return;
      }
      safeSet(getStorage("session"), key, value);
    },
    removeItem(key: string) {
      safeRemove(getStorage("local"), key);
      safeRemove(getStorage("session"), key);
    },
  };
}
