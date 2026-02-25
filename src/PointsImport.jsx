// src/PointsImport.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

// --- helpers ---

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      // "data:...;base64,AAAA"
      const b64 = result.includes(",") ? result.split(",")[1] : "";
      if (!b64) {
        reject(new Error("Neveljaven base64 (datoteka se ni pravilno prebrala)."));
        return;
      }
      resolve(b64);
    };

    reader.onerror = () => reject(new Error("Napaka pri branju datoteke (FileReader error)."));
    reader.readAsDataURL(file);
  });
}

function humanFileSize(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function isSupportedFile(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
}

// --- component ---

export default function PointsImport({ open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  const fileInfo = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name || "file",
      size: file.size || 0,
      sizeLabel: humanFileSize(file.size || 0),
      supported: isSupportedFile(file),
    };
  }, [file]);

  // reset state whenever modal opens/closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setBusy(false);
      setErr("");
      setResult(null);
    }
  }, [open]);

  async function handleImport() {
    try {
      setErr("");
      setResult(null);

      if (!file) {
        setErr("Najprej izberi CSV ali Excel datoteko.");
        return;
      }

      if (!isSupportedFile(file)) {
        setErr("Podprto: .csv ali .xlsx/.xls");
        return;
      }

      setBusy(true);

      const contentBase64 = await fileToBase64(file);

      // IMPORTANT:
      // Če si v backend dodal alias route, lahko ostane /ld/points/import
      // Če ne, uporabi /ld/points/import-file
      const data = await api("/ld/points/import", {
        method: "POST",
        body: {
          filename: file.name,
          contentBase64,
        },
      });

      setResult(data);

      // trigger refresh in parent (BoundaryMap remount)
      if (typeof onDone === "function") {
        await onDone();
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (busy) return;
    if (typeof onClose === "function") onClose();
  }

  if (!open) return null;

  return (
    <div
      onMouseDown={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          background: "#fff",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Uvozi točke (CSV / Excel)</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.35 }}>
              Datoteka mora imeti stolpce: <b>pointId</b>, <b>ldId</b>, <b>lat</b>, <b>lng</b>.
              <br />
              Ostalo opcijsko: ldIme, type, name, notes, status, source.
              <br />
              Anti-dupliranje: isti <b>ldId__pointId</b> se samo posodobi (ne naredi nove točke).
              <br />
              Dostop: <b>super</b> only.
            </div>
          </div>

          <button className="btn-mini" onClick={handleClose} disabled={busy}>
            Zapri
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Izberi datoteko</div>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setErr("");
              setResult(null);
            }}
          />

          {fileInfo ? (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
              Izbrano: <b>{fileInfo.name}</b> ({fileInfo.sizeLabel}){" "}
              {!fileInfo.supported ? <span style={{ color: "#a00", fontWeight: 900 }}>— napačen format</span> : null}
            </div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65 }}>Ni izbrane datoteke.</div>
          )}
        </div>

        {err ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ffd0d0",
              background: "#fff1f1",
              color: "#7a1212",
              fontWeight: 800,
            }}
          >
            {err}
          </div>
        ) : null}

        {result ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #b7f2c1",
              background: "#f0fff3",
              color: "#0b4d1a",
            }}
          >
            <div style={{ fontWeight: 900 }}>Import OK</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              processed: <b>{result.processed ?? "?"}</b> &nbsp;|&nbsp; skipped: <b>{result.skipped ?? "?"}</b>
              <br />
              {result.message ? (
                <>
                  message: <b>{result.message}</b>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button className="btn-mini" onClick={handleClose} disabled={busy}>
            Zapri
          </button>

          <button
            className="btn-mini"
            onClick={handleImport}
            disabled={busy || !file || (fileInfo ? !fileInfo.supported : true)}
            style={{
              opacity: busy || !file || (fileInfo ? !fileInfo.supported : true) ? 0.6 : 1,
              fontWeight: 900,
            }}
          >
            {busy ? "Uvažam..." : "Uvozi"}
          </button>
        </div>
      </div>
    </div>
  );
}
