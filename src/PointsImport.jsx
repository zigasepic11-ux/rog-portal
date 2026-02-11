// src/PointsImport.jsx
import { useMemo, useRef, useState } from "react";
import { api } from "./api.js";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Ne morem prebrati datoteke."));
    r.onload = () => {
      const s = String(r.result || "");
      const idx = s.indexOf("base64,");
      if (idx >= 0) return resolve(s.slice(idx + 7));
      resolve(s);
    };
    r.readAsDataURL(file);
  });
}

function stop(e) {
  e.preventDefault();
  e.stopPropagation();
}

export default function PointsImport({ open, onClose, onDone }) {
  const inputRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const accept = useMemo(() => ".csv,.xlsx,.xls", []);

  async function handleFile(file) {
    if (!file) return;

    setErr("");
    setMsg("");

    const ext = String(file.name || "").toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      setErr("Dovoli samo .csv ali .xlsx/.xls");
      return;
    }

    setBusy(true);
    try {
      const b64 = await fileToBase64(file);

      // IMPORTANT: endpoint mora biti enak kot v backendu
      const out = await api("/ld/points/import-file", {
        method: "POST",
        body: { filename: file.name, contentBase64: b64 },
      });

      setMsg(`Uvoz OK — processed: ${out.processed}, skipped: ${out.skipped}`);
      onDone?.();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function onPickClick() {
    // mora biti direct user action -> click handler
    inputRef.current?.click();
  }

  function onInputChange(e) {
    const f = e.target.files?.[0];
    // reset, da lahko izbereš isto datoteko še enkrat
    e.target.value = "";
    handleFile(f);
  }

  function onDrop(e) {
    stop(e);
    const f = e.dataTransfer?.files?.[0];
    handleFile(f);
  }

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 96vw)" }}>
        <h3 className="modal-title">Uvozi točke (CSV/XLSX)</h3>

        <div className="page-sub" style={{ marginBottom: 10 }}>
          Uvozi se dela kot <b>SUPER</b> za trenutno izbrano LD (switch-ld).
          <br />
          Anti-duplicate: <b>docId = ldId__pointId</b> (isti pointId se samo posodobi).
        </div>

        {err ? (
          <div className="error" style={{ marginBottom: 10 }}>
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="pin-box" style={{ marginBottom: 10 }}>
            {msg}
          </div>
        ) : null}

        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={onInputChange} />

        <div
          onDragOver={stop}
          onDrop={onDrop}
          style={{
            border: "2px dashed rgba(107,78,46,.35)",
            borderRadius: 14,
            padding: 18,
            background: "rgba(255,255,255,.7)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Klikni ali dropaj datoteko</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Dovoljene: .csv, .xlsx, .xls</div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn-mini" onClick={onPickClick} disabled={busy}>
              {busy ? "Uvažam..." : "Izberi datoteko"}
            </button>

            <button className="btn-mini" onClick={onClose} style={{ opacity: 0.85 }} disabled={busy}>
              Zapri
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
