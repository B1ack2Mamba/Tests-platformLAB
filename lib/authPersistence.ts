export const AUTH_REMEMBER_DEVICE_KEY = "lk-auth-remember-device";

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

export function getAuthRememberDevicePreference() {
  const saved = safeGet(getStorage("local"), AUTH_REMEMBER_DEVICE_KEY);
  return saved !== "0";
}

export function setAuthRememberDevicePreference(remember: boolean) {
  safeSet(getStorage("local"), AUTH_REMEMBER_DEVICE_KEY, remember ? "1" : "0");
}

export function createSupabaseAuthStorage() {
  return {
    getItem(key: string) {
      const remember = getAuthRememberDevicePreference();
      const primary = getStorage(remember ? "local" : "session");
      const secondary = getStorage(remember ? "session" : "local");
      return safeGet(primary, key) ?? safeGet(secondary, key);
    },
    setItem(key: string, value: string) {
      const remember = getAuthRememberDevicePreference();
      if (remember) {
        if (safeSet(getStorage("local"), key, value)) {
          safeRemove(getStorage("session"), key);
        } else {
          safeSet(getStorage("session"), key, value);
        }
        return;
      }
      safeSet(getStorage("session"), key, value);
      safeRemove(getStorage("local"), key);
    },
    removeItem(key: string) {
      safeRemove(getStorage("local"), key);
      safeRemove(getStorage("session"), key);
    },
  };
}
