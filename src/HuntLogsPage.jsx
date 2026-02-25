// src/HuntLogsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { api, apiDownload } from "./api.js";
import HuntLocationModal from "./components/HuntLocationModal.jsx";

function toInputDate(d) {
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI");
  } catch {
    return iso;
  }
}

function canShowMap(log) {
  const mode = String(log?.locationMode || "");
  if (mode === "private_text") return false;
  if (mode === "poi") return log?.lat != null && log?.lng != null;
  if (mode === "approx")
    return (log?.approxLat != null && log?.approxLng != null) || (log?.lat != null && log?.lng != null);
  return log?.lat != null && log?.lng != null;
}

function normalizeForModal(log) {
  if (log?.locationMode) return log;

  if (log?.lat != null && log?.lng != null) {
    return {
      ...log,
      locationMode: "approx",
      approxLat: log.lat,
      approxLng: log.lng,
      approxRadiusM: typeof log?.approxRadiusM === "number" ? log.approxRadiusM : 1000,
    };
  }

  return { ...log, locationMode: "private_text" };
}

export default function HuntLogsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [logs, setLogs] = useState([]);

  const [harvestFilter, setHarvestFilter] = useState("all"); // all | yes | no

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", `${from}T00:00:00`);
      if (to) qs.set("to", `${to}T23:59:59`);
      qs.set("limit", "500");

      const out = await api(`/ld/hunt-logs?${qs.toString()}`);
      setLogs(out.logs || []);
    } catch (e) {
      setErr(e.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLogs = useMemo(() => {
    if (harvestFilter === "yes") return logs.filter((x) => !!x.harvest);
    if (harvestFilter === "no") return logs.filter((x) => !x.harvest);
    return logs;
  }, [logs, harvestFilter]);

  const total = filteredLogs.length;
  const harvested = useMemo(() => filteredLogs.filter((x) => x.harvest).length, [filteredLogs]);

  function openMapRow(row) {
    setSelected(normalizeForModal(row));
    setOpen(true);
  }

  function backendFilter() {
    if (harvestFilter === "yes") return "harvest";
    if (harvestFilter === "no") return "noharvest";
    return "all";
  }

  async function exportPdf() {
    setErr("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", `${from}T00:00:00`);
      if (to) qs.set("to", `${to}T23:59:59`);
      qs.set("filter", backendFilter());
      qs.set("limit", "2000");

      await apiDownload(
        `/ld/hunt-logs/export-pdf?${qs.toString()}`,
        `hunt_logs_${from}_${to}_${harvestFilter}.pdf`
      );
    } catch (e) {
      setErr(e.message);
    }
  }

  async function exportCsv() {
    setErr("");
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", `${from}T00:00:00`);
      if (to) qs.set("to", `${to}T23:59:59`);
      qs.set("filter", backendFilter());
      qs.set("limit", "2000");

      await apiDownload(
        `/ld/hunt-logs/export-csv?${qs.toString()}`,
        `hunt_logs_${from}_${to}_${harvestFilter}.csv`
      );
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <div className="stat" style={{ marginBottom: 12 }}>
        <h4>Filtri</h4>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ minWidth: 200 }}>
            <div className="label">Od</div>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div style={{ minWidth: 200 }}>
            <div className="label">Do</div>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div style={{ minWidth: 220 }}>
            <div className="label">Uplen</div>
            <select
              className="input"
              style={{ height: 54 }}
              value={harvestFilter}
              onChange={(e) => setHarvestFilter(e.target.value)}
            >
              <option value="all">Vsi</option>
              <option value="yes">Samo z uplenom</option>
              <option value="no">Samo brez uplena</option>
            </select>
          </div>

          <button className="btn-mini" onClick={load} disabled={loading}>
            {loading ? "Nalagam..." : "Prikaži"}
          </button>

          

          <button className="btn-mini" onClick={exportPdf} disabled={!filteredLogs.length}>
            Export PDF
          </button>

          <div style={{ marginLeft: "auto", fontWeight: 900, color: "#6B4E2E" }}>
            Skupaj: {total} | Uplen: {harvested}
          </div>
        </div>

        {err && (
          <div className="error" style={{ marginTop: 10 }}>
            {err}
          </div>
        )}
      </div>

      <div className="stat">
        <h4>Dnevniki lova</h4>

        {!loading && !filteredLogs.length && <div className="desc">Ni zapisov za izbran interval/filter.</div>}

        {!!filteredLogs.length && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 8 }}>Lovec</th>
                  <th style={{ padding: 8 }}>Začetek</th>
                  <th style={{ padding: 8 }}>Konec</th>
                  <th style={{ padding: 8 }}>Uplen</th>
                  <th style={{ padding: 8 }}>Vrsta</th>
                  <th style={{ padding: 8 }}>Razlog</th>
                  <th style={{ padding: 8 }}>Opombe</th>
                  <th style={{ padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((x) => (
                  <tr key={x.id} style={{ borderTop: "1px solid rgba(107,78,46,.2)" }}>
                    <td style={{ padding: 8, fontWeight: 900 }}>{x.hunterName || "—"}</td>
                    <td style={{ padding: 8 }}>{fmt(x.startedAt)}</td>
                    <td style={{ padding: 8 }}>{fmt(x.finishedAt)}</td>
                    <td style={{ padding: 8 }}>
                      <span className={"pill " + (x.harvest ? "pill-on" : "pill-off")}>
                        {x.harvest ? "UPLEN" : "BREZ"}
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>{x.species || "—"}</td>
                    <td style={{ padding: 8 }}>{x.endedReason || "—"}</td>
                    <td
                      style={{
                        padding: 8,
                        maxWidth: 420,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {x.notes || "—"}
                    </td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      <button className="btn-mini" onClick={() => openMapRow(x)} disabled={!canShowMap(x)}>
                        Prikaži na mapi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="desc" style={{ marginTop: 10 }}>
              Namig: filter “Uplen” vpliva tudi na Export CSV/PDF.
            </div>
          </div>
        )}
      </div>

      <HuntLocationModal open={open} onClose={() => setOpen(false)} hunt={selected} />
    </div>
  );
}
