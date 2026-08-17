import { useEffect, useState } from "react";

export type InterfaceMode = "light" | "classic";

export const INTERFACE_MODE_STORAGE_KEY = "commercialInterfaceMode:v1";
export const INTERFACE_MODE_EVENT = "commercial-interface-mode-change";
export const MOBILE_INTERFACE_MEDIA_QUERY = "(max-width: 767px)";

function isInterfaceMode(value: unknown): value is InterfaceMode {
  return value === "light" || value === "classic";
}

export function readInterfaceMode(): InterfaceMode {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(INTERFACE_MODE_STORAGE_KEY);
    return isInterfaceMode(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function storeInterfaceMode(mode: InterfaceMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTERFACE_MODE_STORAGE_KEY, mode);
  } catch {}
  window.dispatchEvent(new CustomEvent<InterfaceMode>(INTERFACE_MODE_EVENT, { detail: mode }));
}

export function useInterfaceMode() {
  const [storedInterfaceMode, setStoredInterfaceMode] = useState<InterfaceMode>("light");
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_INTERFACE_MEDIA_QUERY);
    const syncFromStorage = () => {
      setStoredInterfaceMode(mobileQuery.matches ? "light" : readInterfaceMode());
    };
    const syncViewport = () => {
      setIsMobileViewport(mobileQuery.matches);
      syncFromStorage();
    };
    const syncFromEvent = (event: Event) => {
      if (mobileQuery.matches) {
        setStoredInterfaceMode("light");
        return;
      }
      const nextMode = (event as CustomEvent<InterfaceMode>).detail;
      setStoredInterfaceMode(isInterfaceMode(nextMode) ? nextMode : readInterfaceMode());
    };
    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.key === INTERFACE_MODE_STORAGE_KEY) syncFromStorage();
    };

    syncViewport();
    mobileQuery.addEventListener("change", syncViewport);
    window.addEventListener(INTERFACE_MODE_EVENT, syncFromEvent);
    window.addEventListener("storage", syncFromAnotherTab);
    return () => {
      mobileQuery.removeEventListener("change", syncViewport);
      window.removeEventListener(INTERFACE_MODE_EVENT, syncFromEvent);
      window.removeEventListener("storage", syncFromAnotherTab);
    };
  }, []);

  const setInterfaceMode = (mode: InterfaceMode) => {
    if (isMobileViewport && mode === "classic") return;
    setStoredInterfaceMode(mode);
    storeInterfaceMode(mode);
  };

  return {
    interfaceMode: isMobileViewport ? "light" : storedInterfaceMode,
    setInterfaceMode,
    isMobileViewport,
  };
}
