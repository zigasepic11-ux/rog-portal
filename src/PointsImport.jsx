// src/PointsImport.jsx
import { useMemo, useState } from "react";
import { api } from "./api.js";

function stop(e) {
  e.preventDefault();
  e.stopPropagation();
}

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

export default function PointsImport({ open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  const fileName = useMemo(() => (file ? file.name : ""), [file]);

  async function upload() {
    if (!file || busy) return;

    setBusy(true);
    setErr("");
    setResult(null);

    try {
      const b64 = await fileToBase64(file);

      const out = await api("/ld/points/import", {
        method: "POST",
        body: {
          filename: file.name,
          contentBase64: b64,
        },
      });

      setResult({
        importedOrUpdated: out?.importedOrUpdated ?? null,
        skipped: out?.skipped ?? null,
      });

      onDone?.();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ zIndex: 9999 }}
    >
      <div className="modal" onClick={stop}>
        <h3 className="modal-title">Uvozi točke (CSV / Excel)</h3>

        <div className="page-sub" style={{ marginBottom: 10 }}>
          Datoteka mora imeti stolpce: <b>pointId</b>, <b>ldId</b>, <b>lat</b>, <b>lng</b>.
          Ostalo je opcijsko: ldName, type, name, notes, status, source.
          <br />
          <b>Anti-dupliranje:</b> isti <code>pointId</code> se samo posodobi (ne naredi nove točke).
        </div>

        {err ? <div className="error">{err}</div> : null}

        <div className="field">
          <div className="label">Izberi datoteko</div>
          <input
            className="input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ paddingTop: 14 }}
          />
          {fileName ? (
            <div className="page-sub" style={{ marginTop: 8 }}>
              Izbrano: <b>{fileName}</b>
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="stat" style={{ marginTop: 10 }}>
            <h4>Rezultat</h4>
            <div className="desc">
              Uvoženo/posodobljeno: <b>{result.importedOrUpdated ?? "—"}</b> • Preskočeno:{" "}
              <b>{result.skipped ?? "—"}</b>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
          <button
            type="button"
            className="btn-mini"
            onClick={onClose}
            style={{ opacity: 0.85, height: 42 }}
            disabled={busy}
          >
            Zapri
          </button>
          <button
            type="button"
            className="btn-mini"
            onClick={upload}
            disabled={!file || busy}
            style={{ height: 42 }}
          >
            {busy ? "Nalagam..." : "Uvozi"}
          </button>
        </div>
      </div>
    </div>
  );
}
