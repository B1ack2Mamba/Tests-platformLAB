/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodeBlock({ value, title = "QR-код", size = 176 }: { value: string; title?: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSrc("");
      return;
    }
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: Math.max(96, size),
      color: {
        dark: "#0f5132",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">Открой ссылку на телефоне или отсканируй QR.</div>
      <div className="mt-4 flex justify-center">
        {src ? (
          <img
            src={src}
            alt="QR code"
            className="rounded-2xl border border-emerald-100 bg-white p-2"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40"
            style={{ width: size, height: size }}
          />
        )}
      </div>
    </div>
  );
}
