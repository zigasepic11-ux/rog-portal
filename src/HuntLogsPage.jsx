// src/HuntLogsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import HuntLocationModal from "./components/HuntLocationModal.jsx";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function toInputDate(d) {
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
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

  function exportCsv() {
    const headers = [
      "hunterName",
      "startedAt",
      "finishedAt",
      "harvest",
      "species",
      "endedReason",
      "notes",
      "locationName",
      "lat",
      "lng",
    ];

    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return `"${s.replaceAll('"', '""')}"`;
    };

    const rows = filteredLogs.map((x) => headers.map((h) => esc(x[h])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `hunt_logs_${from}_${to}_${harvestFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const title = `ROG – Dnevniki lova (${from} → ${to})`;
    doc.setFontSize(16);
    doc.text(title, 40, 40);

    doc.setFontSize(10);
    doc.text(`Filter: ${harvestFilter}   |   Skupaj: ${total}   |   Uplen: ${harvested}`, 40, 60);

    const head = [["Lovec", "Začetek", "Konec", "Uplen", "Vrsta", "Razlog", "Lokacija", "Lat", "Lng", "Opombe"]];

    const body = filteredLogs.map((x) => [
      x.hunterName || "—",
      fmt(x.startedAt),
      fmt(x.finishedAt),
      x.harvest ? "UPLEN" : "BREZ",
      x.species || "—",
      x.endedReason || "—",
      x.locationName || "—",
      x.lat == null ? "" : String(x.lat),
      x.lng == null ? "" : String(x.lng),
      x.notes || "—",
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 80,
      styles: {
        fontSize: 9,
        cellPadding: 5,
        overflow: "linebreak",
      },
      headStyles: {
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 120 },
        2: { cellWidth: 120 },
        3: { cellWidth: 70 },
        4: { cellWidth: 90 },
        5: { cellWidth: 80 },
        6: { cellWidth: 140 },
        7: { cellWidth: 80 },
        8: { cellWidth: 80 },
        9: { cellWidth: 220 },
      },
      margin: { left: 40, right: 40 },
    });

    doc.save(`hunt_logs_${from}_${to}_${harvestFilter}.pdf`);
  }

  function openMapRow(row) {
    setSelected(normalizeForModal(row));
    setOpen(true);
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

          <button className="btn-mini" onClick={exportCsv} disabled={!filteredLogs.length}>
            Export CSV
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
