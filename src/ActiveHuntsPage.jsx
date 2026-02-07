// src/ActiveHuntsPage.jsx
import { useEffect, useState } from "react";
import { api } from "./api.js";
import HuntLocationModal from "./components/HuntLocationModal.jsx";

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function modeLabel(m) {
  const t = String(m || "private_text");
  if (t === "poi") return "POI (točno)";
  if (t === "approx") return "Območje (~)";
  return "Tekst (skrito)";
}

export default function ActiveHuntsPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const out = await api("/ld/active-hunts");
      const list = out.active || out.hunts || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openMap(hunt) {
    setSelected(hunt);
    setOpen(true);
  }

  return (
    <div className="stat">
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <button className="btn-mini" onClick={load} disabled={loading}>
          {loading ? "Nalagam..." : "Osveži"}
        </button>
        {err && (
          <div className="error" style={{ margin: 0 }}>
            {err}
          </div>
        )}
      </div>

      <h4>Aktivni lovci</h4>

      {loading && <div className="desc">Nalagam...</div>}
      {!loading && rows.length === 0 && <div className="desc">Trenutno ni aktivnih lovov.</div>}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Lovec</th>
                <th>Začetek</th>
                <th>Način</th>
                <th>Lokacija</th>
                <th>Koordinate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const mode = x.locationMode || "private_text";

                const coords =
                  mode === "poi" && x.lat != null && x.lng != null
                    ? `${Number(x.lat).toFixed(5)}, ${Number(x.lng).toFixed(5)}`
                    : mode === "approx" && x.approxLat != null && x.approxLng != null
                    ? `~ ${Number(x.approxLat).toFixed(5)}, ${Number(x.approxLng).toFixed(5)} (${Math.round(
                        Number(x.approxRadiusM || 1000)
                      )}m)`
                    : "—";

                const canShowMap =
                  mode !== "private_text" &&
                  ((mode === "poi" && x.lat != null && x.lng != null) ||
                    (mode === "approx" && x.approxLat != null && x.approxLng != null));

                return (
                  <tr key={x.uid || x.hunterId || Math.random()}>
                    <td>{x.hunterName || "—"}</td>
                    <td>{fmt(x.startedAt)}</td>
                    <td>{modeLabel(mode)}</td>
                    <td>{x.locationName || "—"}</td>
                    <td>{coords}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-mini" onClick={() => openMap(x)} disabled={!canShowMap}>
                        Prikaži na mapi
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="desc" style={{ marginTop: 10 }}>
            Opomba: “Tekst (skrito)” namerno nima koordinat. “POI” pokaže ikono točke, “Območje” pokaže samo krog.
          </div>
        </div>
      )}

      <HuntLocationModal open={open} onClose={() => setOpen(false)} hunt={selected} />
    </div>
  );
}
