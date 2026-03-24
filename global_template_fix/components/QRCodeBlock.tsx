import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodeBlock({ value, title = "QR-код" }: { value: string; title?: string }) {
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
      width: 240,
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
  }, [value]);

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">Открой ссылку на телефоне или отсканируй QR.</div>
      <div className="mt-4 flex justify-center">
        {src ? <img src={src} alt="QR code" className="h-44 w-44 rounded-2xl border border-emerald-100 bg-white p-2" /> : <div className="h-44 w-44 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40" />}
      </div>
    </div>
  );
}
