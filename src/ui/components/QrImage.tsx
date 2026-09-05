import { useEffect, useState } from "react";

/** Renders a QR code for a share URL. Loads the encoder lazily so the phone
 * controller and report bundles never pay for it. */
export function QrImage({ value, label }: { value: string; label: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setFailed(false);
    import("qrcode")
      .then((qr) => qr.toDataURL(value, { margin: 1, width: 224, color: { dark: "#111820", light: "#ffffff" } }))
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  if (failed) return <span className="bs-meta">QR unavailable; use the link.</span>;
  if (!dataUrl) return <div className="bs-skeleton" style={{ width: 112, height: 112 }} aria-hidden="true" />;
  return <img src={dataUrl} alt={label} />;
}
