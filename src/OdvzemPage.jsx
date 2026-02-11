// src/OdvzemPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function defaultYear() {
  return String(new Date().getFullYear());
}

function toNumOrNull(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmtNum(v) {
  const n = toNumOrNull(v);
  return n == null ? "—" : String(n);
}

function pct(executed, plan) {
  const p = toNumOrNull(plan);
  const e = toNumOrNull(executed);
  if (p == null || p === 0 || e == null) return "—";
  return `${Math.round((e / p) * 100)}%`;
}

function statusIcon(plan, executed) {
  const p = toNumOrNull(plan);
  const e = toNumOrNull(executed);
  if (p == null || p === 0 || e == null) return "—";

  const ratio = e / p;
  if (ratio >= 0.9 && ratio <= 1.1) return "🟢";
  if (ratio >= 0.7 && ratio < 0.9) return "🟡";
  return "🔴";
}

/**
 * True total row:
 * - "skupaj"
 * - "<divjad> skupaj"
 * Brez moški/ženski/mladiči...
 */
function isTrueTotalLabel(label) {
  const s = String(label || "").trim().toLowerCase();
  if (!s) return false;

  if (s.includes("moški") || s.includes("moski")) return false;
  if (s.includes("ženski") || s.includes("zenski")) return false;
  if (s.includes("mladi")) return false;

  if (s === "skupaj") return true;
  if (s.endsWith(" skupaj")) return true;
  return false;
}

/**
 * Vmesni subtotali, ki jih želimo skriti:
 * - "skupaj moški spol"
 * - "skupaj ženski spol"
 * - itd.
 */
function isHiddenSubtotal(label) {
  const s = String(label || "").trim().toLowerCase();
  if (!s) return false;

  const hasTogether = s.includes("skupaj");
  const isSexSubtotal = s.includes("moški") || s.includes("moski") || s.includes("ženski") || s.includes("zenski");
  const isYoungSubtotal = s.includes("mladi");

  if (hasTogether && (isSexSubtotal || isYoungSubtotal) && !isTrueTotalLabel(label)) return true;
  return false;
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

function exportOdvzemPdf(view, year, displayRows, totals) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const title = `ROG – Realizacija odvzema (${year})`;
  doc.setFontSize(16);
  doc.text(title, 40, 40);

  doc.setFontSize(10);
  doc.text(
    `LD: ${view?.ldId || "—"}   |   Plan: ${totals.plan ?? "—"}   |   Odstrel: ${totals.exec}   |   Pending: ${
      totals.pend
    }   |   ${totals.percent}`,
    40,
    60
  );

  const head = [["Divjad", "Razred", "Plan", "Odstrel", "Pending", "%", "Status"]];

  const body = displayRows
    .filter((r) => r._type !== "header")
    .map((r) => [
      r.species || "",
      r.classLabel || "",
      r.plan == null ? "" : String(r.plan),
      r.executed == null ? "" : String(r.executed),
      r.pending == null ? "" : String(r.pending),
      pct(r.executed, r.plan),
      statusIcon(r.plan, r.executed),
    ]);

  autoTable(doc, {
    head,
    body,
    startY: 80,
    styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fontStyle: "bold" },
    margin: { left: 40, right: 40 },
    columnStyles: {
      0: { cellWidth: 160 },
      1: { cellWidth: 250 },
      2: { cellWidth: 80 },
      3: { cellWidth: 80 },
      4: { cellWidth: 80 },
      5: { cellWidth: 60 },
      6: { cellWidth: 60 },
    },
  });

  doc.save(`odvzem_${year}.pdf`);
}

function exportOdvzemExcel(view, year, displayRows, totals) {
  const rows = [];

  rows.push(["ROG – Realizacija odvzema", year]);
  rows.push(["LD", view?.ldId || "—"]);
  rows.push(["Plan", totals.plan ?? "—", "Odstrel", totals.exec, "Pending", totals.pend, "%", totals.percent]);
  rows.push([]);
  rows.push(["Divjad", "Razred", "Plan", "Odstrel", "Pending", "%", "Status"]);

  for (const r of displayRows) {
    if (r._type === "header") {
      rows.push([r.species]);
      continue;
    }
    rows.push([
      r.species || "",
      r.classLabel || "",
      r.plan == null ? "" : Number(r.plan),
      r.executed == null ? "" : Number(r.executed),
      r.pending == null ? "" : Number(r.pending),
      pct(r.executed, r.plan),
      statusIcon(r.plan, r.executed),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Odvzem");

  XLSX.writeFile(wb, `odvzem_${year}.xlsx`);
}

export default function OdvzemPage() {
  const [year, setYear] = useState(defaultYear());

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null);

  const timerRef = useRef(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const out = await api(`/ld/odvzem-view?year=${encodeURIComponent(year)}`);
      setView(out?.view || null);
    } catch (e) {
      setView(null);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      load();
    }, 20000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const rows = useMemo(() => {
    const r = Array.isArray(view?.rows) ? view.rows : [];
    return [...r].sort((a, b) => {
      const sa = String(a?.species || "").localeCompare(String(b?.species || ""));
      if (sa !== 0) return sa;

      const la = String(a?.classLabel || "");
      const lb = String(b?.classLabel || "");
      const ta = isTrueTotalLabel(la) ? 1 : 0;
      const tb = isTrueTotalLabel(lb) ? 1 : 0;
      if (ta !== tb) return ta - tb;

      return la.localeCompare(lb);
    });
  }, [view?.rows]);

  const displayRows = useMemo(() => {
    const out = [];

    const bySpecies = new Map();
    for (const r of rows) {
      const sp = String(r?.species || "").trim();
      if (!sp) continue;
      if (!bySpecies.has(sp)) bySpecies.set(sp, []);
      bySpecies.get(sp).push(r);
    }

    const speciesList = Array.from(bySpecies.keys()).sort((a, b) => a.localeCompare(b));

    for (const sp of speciesList) {
      const list = bySpecies.get(sp) || [];
      const total = list.find((x) => isTrueTotalLabel(x?.classLabel));

      const details = list
        .filter((x) => {
          const label = String(x?.classLabel || "");
          if (isHiddenSubtotal(label)) return false;
          if (isTrueTotalLabel(label)) return false;
          return true;
        })
        .map((d) => ({
          _type: "detail",
          species: sp,
          classLabel: String(d?.classLabel || "").trim() || "—",
          plan: toNumOrNull(d?.plan),
          executed: toNumOrNull(d?.executed) ?? 0,
          pending: toNumOrNull(d?.pending) ?? 0,
        }));

      out.push({ _type: "header", species: sp });
      for (const d of details) out.push(d);

      const computedExec = details.reduce((s, x) => s + (toNumOrNull(x.executed) ?? 0), 0);
      const computedPend = details.reduce((s, x) => s + (toNumOrNull(x.pending) ?? 0), 0);

      out.push({
        _type: "total",
        species: sp,
        classLabel: "Skupaj",
        plan: total ? toNumOrNull(total?.plan) : null,
        executed: total ? (toNumOrNull(total?.executed) ?? computedExec) : computedExec,
        pending: total ? (toNumOrNull(total?.pending) ?? computedPend) : computedPend,
      });
    }

    return out;
  }, [rows]);

  const totals = useMemo(() => {
    let plan = 0;
    let planHasAny = false;
    let exec = 0;
    let pend = 0;

    for (const r of displayRows) {
      if (r._type === "detail") {
        exec += toNumOrNull(r.executed) ?? 0;
        pend += toNumOrNull(r.pending) ?? 0;
      }
      if (r._type === "total") {
        const p = toNumOrNull(r.plan);
        if (p != null) {
          plan += p;
          planHasAny = true;
        }
      }
    }

    return {
      plan: planHasAny ? plan : null,
      exec,
      pend,
      percent: pct(exec, planHasAny ? plan : null),
    };
  }, [displayRows]);

  const hasAny = displayRows.length > 0;

  async function importExcel() {
    setErr("");

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        const b64 = await fileToBase64(file);

        await api(`/ld/odvzem-plan/import-excel?year=${encodeURIComponent(year)}`, {
          method: "POST",
          body: { filename: file.name, contentBase64: b64 },
        });

        await load();
      } catch (e) {
        setErr(e?.message || String(e));
      } finally {
        setImporting(false);
      }
    };

    input.click();
  }

  const subtitle = useMemo(() => {
    const ld = view?.ldId ? String(view.ldId) : "";
    const up = view?.updatedAt ? new Date(view.updatedAt).toLocaleString() : "—";
    return `Realizacija odvzema – ${ld || "LD"} , ${year} • Zadnja posodobitev plana: ${up} • Auto refresh: 20s`;
  }, [view?.ldId, view?.updatedAt, year]);

  return (
    <div>
      <div className="stat" style={{ marginBottom: 12 }}>
        <h4>Filtri</h4>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ minWidth: 220 }}>
            <div className="label">Leto</div>
            <input
              className="input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="npr. 2026"
              style={{ height: 54 }}
            />
          </div>

          <button className="btn-mini" onClick={load} disabled={loading || importing}>
            {loading ? "Nalagam..." : "Osveži"}
          </button>

          <button className="btn-mini" onClick={importExcel} disabled={loading || importing}>
            {importing ? "Uvažam..." : "Uvozi Excel"}
          </button>

          <button
            className="btn-mini"
            onClick={() => exportOdvzemPdf(view, year, displayRows, totals)}
            disabled={!view || loading || importing || !hasAny}
          >
            Export PDF
          </button>

          <button
            className="btn-mini"
            onClick={() => exportOdvzemExcel(view, year, displayRows, totals)}
            disabled={!view || loading || importing || !hasAny}
          >
            Export Excel
          </button>

          <div style={{ marginLeft: "auto", fontWeight: 900, color: "#6B4E2E" }}>
            Plan: {totals.plan == null ? "—" : totals.plan} | Odstrel: {totals.exec} | Pending: {totals.pend} |{" "}
            {totals.percent}
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>{subtitle}</div>

        {err && (
          <div className="error" style={{ marginTop: 10 }}>
            {err}
          </div>
        )}
      </div>

      <div className="stat">
        <h4>Plan realizacije (pregledno)</h4>

        {!loading && !hasAny && (
          <div className="desc">Ni uvoženega plana za to leto. (Moderator/super naj klikne “Uvozi Excel”.)</div>
        )}

        {!!hasAny && (
          <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(250,250,250,0.95)" }}>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 10, width: 260 }}>Divjad</th>
                  <th style={{ padding: 10 }}>Razred</th>
                  <th style={{ padding: 10, width: 110 }}>Plan</th>
                  <th style={{ padding: 10, width: 110 }}>Odstrel</th>
                  <th style={{ padding: 10, width: 110 }}>Pending</th>
                  <th style={{ padding: 10, width: 120 }}>%</th>
                  <th style={{ padding: 10, width: 90 }}>Status</th>
                </tr>
              </thead>

              <tbody>
                {displayRows.map((r, idx) => {
                  if (r._type === "header") {
                    return (
                      <tr key={`h-${r.species}-${idx}`} style={{ borderTop: "2px solid rgba(107,78,46,.22)" }}>
                        <td style={{ padding: "12px 10px", fontWeight: 950, color: "#6B4E2E" }}>{r.species}</td>
                        <td colSpan={6} style={{ padding: "12px 10px", opacity: 0.55 }} />
                      </tr>
                    );
                  }

                  const isTotal = r._type === "total";
                  const plan = r.plan;
                  const executed = r.executed;
                  const pending = r.pending;

                  return (
                    <tr
                      key={`${r._type}-${r.species}-${r.classLabel}-${idx}`}
                      style={{
                        borderTop: "1px solid rgba(107,78,46,.14)",
                        background: isTotal ? "rgba(255,255,255,.70)" : "transparent",
                      }}
                    >
                      <td style={{ padding: 10, color: "rgba(0,0,0,0)" }}>{r.species}</td>
                      <td
                        style={{
                          padding: 10,
                          fontWeight: isTotal ? 950 : 800,
                          color: isTotal ? "#6B4E2E" : "rgba(43,43,43,.88)",
                        }}
                      >
                        {r.classLabel}
                      </td>
                      <td style={{ padding: 10, fontWeight: isTotal ? 950 : 800 }}>{fmtNum(plan)}</td>
                      <td style={{ padding: 10, fontWeight: isTotal ? 950 : 800 }}>{fmtNum(executed)}</td>
                      <td style={{ padding: 10, fontWeight: isTotal ? 950 : 800 }}>{fmtNum(pending)}</td>
                      <td style={{ padding: 10, fontWeight: 950, color: "#6B4E2E" }}>{pct(executed, plan)}</td>
                      <td style={{ padding: 10, fontWeight: 950 }}>{statusIcon(plan, executed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Prikaz: pri vsaki divjadi je samo 1× “Skupaj”. Skriti so “skupaj moški/ženski …”, da je tabela bolj zračna.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
