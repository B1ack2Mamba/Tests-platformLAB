import type { AppProps } from "next/app";
import Head from "next/head";
import Script from "next/script";
import { useEffect } from "react";
import "@/styles/globals.css";
import dynamic from "next/dynamic";

// Native runtime overlay (Capacitor): client-side only
const NativeRuntimeNoSSR = dynamic(
  () => import("@/components/NativeRuntime").then((m) => m.NativeRuntime),
  { ssr: false }
);

export default function App({ Component, pageProps }: AppProps) {
  const shouldAllowPwa = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_PWA === "1";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      // В DEV и без явного флага PWA мы насильно убираем service worker,
      // иначе браузер держит старые JS/CSS чанки и пользователь видит
      // устаревший UI/логику даже после обновления проекта.
      const pwaEnabled = shouldAllowPwa;

      // Если это Capacitor (нативная оболочка) — тоже не регистрируем SW.
      try {
        const core = await import("@capacitor/core");
        if (core.Capacitor.isNativePlatform()) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          return;
        }
      } catch {
        // capacitor not installed / web
      }

      if (!pwaEnabled) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          if (typeof caches !== "undefined") {
            const keys = await caches.keys();
            await Promise.all(
              keys
                .filter((k) => k.includes("krost-tests-static") || k.includes("laboratoriya") || k.includes("tests-static"))
                .map((k) => caches.delete(k))
            );
          }
        } catch {
          // ignore
        }
        return;
      }

      const onLoad = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // silent
        });
      };

      window.addEventListener("load", onLoad);
      cleanup = () => window.removeEventListener("load", onLoad);
    })();

    return () => {
      try {
        cleanup?.();
      } catch {
        // ignore
      }
    };
  }, [shouldAllowPwa]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#eef2ff" />
        <link rel="icon" href="/krost-mark.png" />

        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </Head>

      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script id="lk-sw-prehydrate-cleanup" strategy="beforeInteractive">{`
        (function () {
          try {
            var allowPwa = ${JSON.stringify(shouldAllowPwa)};
            var isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
            if (allowPwa && !isLocalHost) return;
            if (!("serviceWorker" in navigator)) return;

            var clearCaches = function () {
              if (typeof caches === "undefined") return Promise.resolve();
              return caches.keys().then(function (keys) {
                return Promise.all(
                  keys
                    .filter(function (key) {
                      return key.indexOf("krost-tests-static") !== -1 || key.indexOf("laboratoriya") !== -1 || key.indexOf("tests-static") !== -1;
                    })
                    .map(function (key) {
                      return caches.delete(key);
                    })
                );
              });
            };

            navigator.serviceWorker.getRegistrations()
              .then(function (registrations) {
                return Promise.all(
                  registrations.map(function (registration) {
                    return registration.unregister();
                  })
                ).then(function () {
                  return registrations.length;
                });
              })
              .then(function (count) {
                return clearCaches().then(function () {
                  return count;
                });
              })
              .then(function (count) {
                try {
                  if (count > 0 && !sessionStorage.getItem("lk-sw-prehydrate-reloaded")) {
                    sessionStorage.setItem("lk-sw-prehydrate-reloaded", "1");
                    location.reload();
                  }
                } catch (e) {}
              })
              .catch(function () {});
          } catch (e) {}
        })();
      `}</Script>

      <NativeRuntimeNoSSR />
      <Component {...pageProps} />
    </>
  );
}
