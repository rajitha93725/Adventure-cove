"use client";
import { useEffect, useRef, useState } from "react";

/**
 * QR input that works with:
 *  - USB / handheld scanners (they "type" the code then press Enter)
 *  - the device camera (html5-qrcode, loaded on demand)
 * Typing a name / mobile and pressing Enter also works (handled by onSearch).
 */
export default function Scanner({
  onScan,
  onSearch,
  placeholder = "Scan QR card, or type mobile / name and press Enter",
}: {
  onScan: (code: string) => void;
  onSearch?: (text: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const [camError, setCamError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (!camera) return;
    let stopped = false;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (stopped) return;
      const s = new Html5Qrcode("qr-camera");
      scanner = s;
      s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (text) => {
          setCamera(false);
          onScan(text);
        },
        () => {},
      ).catch((e: unknown) => setCamError(String(e)));
    });
    return () => {
      stopped = true;
      scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [camera, onScan]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setValue("");
    // QR cards encode "ACV:<18 hex>"; a bare 18-hex token is also accepted.
    if (/^acv:/i.test(v) || /^[0-9a-f]{18}$/i.test(v)) onScan(v);
    else onSearch?.(v);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          className="input text-lg"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button className="btn-primary">Go</button>
        <button type="button" className="btn-ghost" onClick={() => { setCamError(""); setCamera((c) => !c); }}>
          {camera ? "Close camera" : "Camera"}
        </button>
      </form>
      {camera && (
        <div className="card">
          <div id="qr-camera" className="mx-auto max-w-sm overflow-hidden rounded-xl" />
          {camError && <p className="mt-2 text-sm text-danger">Camera error: {camError}</p>}
        </div>
      )}
    </div>
  );
}
