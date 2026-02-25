// src/OdvzemPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE, getToken } from "./api.js";

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

function isHiddenSubtotal(label) {
  const s = String(label || "").trim().toLowerCase();
  if (!s) return false;

  const hasTogether = s.includes("skupaj");
  const isSexSubtotal =
    s.includes("moški") || s.includes("moski") || s.includes("ženski") || s.includes("zenski");
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

/** ✅ Download blob iz backend-a (PDF/XLSX) z istim tokenom kot api() */
async function downloadFile(path, filename) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text || `Napaka ${res.status}`;
    try {
      const j = JSON.parse(text);
      msg = j?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();

  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
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

/* ================= UI HELPERS (OLD MONEY) ================= */

function IconPencil({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l8.06-8.06.92.92L5.92 20.08zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
      />
    </svg>
  );
}

function ConfirmModal({ open, title, children, onClose, busy }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
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
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid rgba(107,78,46,.18)",
          boxShadow: "0 18px 50px rgba(0,0,0,.22)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 950, color: "#6B4E2E" }}>{title}</div>
          <button
            className="btn-mini"
            onClick={onClose}
            disabled={busy}
            style={{
              background: "transparent",
              border: "1px solid rgba(107,78,46,.25)",
              color: "#6B4E2E",
              borderRadius: 999,
              padding: "8px 12px",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Zapri
          </button>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

/* ================= PAGE ================= */

export default function OdvzemPage() {
  const [year, setYear] = useState(defaultYear());

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null);

  const timerRef = useRef(null);

  // ✅ edit mode + modal state (NEW)
  const [editMode, setEditMode] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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
      const sa = String(a?.species || "").localeCompare(String(b?.species || ""), "sl");
      if (sa !== 0) return sa;

      const la = String(a?.classLabel || "");
      const lb = String(b?.classLabel || "");
      const ta = isTrueTotalLabel(la) ? 1 : 0;
      const tb = isTrueTotalLabel(lb) ? 1 : 0;
      if (ta !== tb) return ta - tb;

      return la.localeCompare(lb, "sl");
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

    const speciesList = Array.from(bySpecies.keys()).sort((a, b) => a.localeCompare(b, "sl"));

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
          key: d.key,
          species: sp,
          classLabel: String(d?.classLabel || "").trim() || "—",
          plan: toNumOrNull(d?.plan),
          executed: toNumOrNull(d?.executed) ?? 0,
          executedAuto: toNumOrNull(d?.executedAuto) ?? 0,
          executedDelta: toNumOrNull(d?.executedDelta) ?? 0,
          override: d?.override || null,
          pending: toNumOrNull(d?.pending) ?? 0,
        }));

      out.push({ _type: "header", species: sp });
      for (const d of details) out.push(d);

      const computedExec = details.reduce((s, x) => s + (toNumOrNull(x.executed) ?? 0), 0);
      const computedPend = details.reduce((s, x) => s + (toNumOrNull(x.pending) ?? 0), 0);

      out.push({
        _type: "total",
        key: total?.key, // total key from plan, if exists
        species: sp,
        classLabel: "Skupaj",
        plan: total ? toNumOrNull(total?.plan) : null,

        executed: total ? (toNumOrNull(total?.executed) ?? computedExec) : computedExec,
        executedAuto: total ? (toNumOrNull(total?.executedAuto) ?? computedExec) : computedExec,
        executedDelta: total ? (toNumOrNull(total?.executedDelta) ?? 0) : 0,
        override: total?.override || null,

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

  async function exportElegantPdf() {
    setErr("");
    try {
      await downloadFile(`/ld/odvzem/export-pdf?year=${encodeURIComponent(year)}`, `odvzem_${year}.pdf`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function exportElegantExcel() {
    setErr("");
    try {
      await downloadFile(`/ld/odvzem/export-excel?year=${encodeURIComponent(year)}`, `odvzem_${year}.xlsx`);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  function openEdit(r) {
    if (!r?.key) {
      setErr("Ta vrstica nima key (ne morem urejati).");
      return;
    }
    setErr("");
    setEditRow(r);
    setEditValue(String(toNumOrNull(r.executed) ?? 0));
    setEditOpen(true);
  }

  function closeEdit() {
    if (savingEdit) return;
    setEditOpen(false);
    setEditRow(null);
    setEditValue("");
  }

  async function saveEdit() {
    if (!editRow?.key) return;

    const desired = toNumOrNull(editValue);
    if (desired == null || desired < 0) {
      setErr("Vpiši veljavno število (0 ali več).");
      return;
    }

    if (!window.confirm("Ali res želiš shraniti spremembo odstrela?")) return;

    setSavingEdit(true);
    setErr("");
    try {
      await api(`/ld/odvzem/override?year=${encodeURIComponent(year)}&key=${encodeURIComponent(editRow.key)}`, {
        method: "PATCH",
        body: { executed: desired, reason: "portal manual edit" },
      });

      await load();
      closeEdit();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSavingEdit(false);
    }
  }

  async function resetEdit() {
    if (!editRow?.key) return;

    if (!window.confirm("Ali res želiš razveljaviti popravek?")) return;

    setSavingEdit(true);
    setErr("");
    try {
      await api(`/ld/odvzem/override?year=${encodeURIComponent(year)}&key=${encodeURIComponent(editRow.key)}`, {
        method: "DELETE",
      });

      await load();
      closeEdit();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSavingEdit(false);
    }
  }

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

          <button className="btn-mini" onClick={exportElegantPdf} disabled={!view || loading || importing || !hasAny}>
            Export PDF
          </button>

          <button className="btn-mini" onClick={exportElegantExcel} disabled={!view || loading || importing || !hasAny}>
            Export Excel
          </button>

          {/* ✅ ONE EDIT TOGGLE (NEW) */}
          <button
            className="btn-mini"
            onClick={() => setEditMode((v) => !v)}
            disabled={loading || importing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              padding: "10px 14px",
              background: editMode ? "#6B4E2E" : "rgba(107,78,46,.10)",
              color: editMode ? "white" : "#6B4E2E",
              border: "1px solid rgba(107,78,46,.25)",
              fontWeight: 900,
            }}
            title="Vklopi/izklopi urejanje"
          >
            <IconPencil size={16} />
            {editMode ? "Urejanje: vklopljeno" : "Urejanje"}
          </button>

          <div style={{ marginLeft: "auto", fontWeight: 900, color: "#6B4E2E" }}>
            Plan: {totals.plan == null ? "—" : totals.plan} | Odstrel: {totals.exec} | Pending: {totals.pend} |{" "}
            {totals.percent}
          </div>
        </div>

        {/* ✅ hint text */}
        <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{subtitle}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {editMode ? "Klikni svinčnik pri vrstici." : ""}
          </div>
        </div>

        {err && (
          <div className="error" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
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
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(250,250,250,0.95)" }}>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 10, width: 260 }}>Divjad</th>
                  <th style={{ padding: 10 }}>Razred</th>
                  <th style={{ padding: 10, width: 110 }}>Plan</th>
                  <th style={{ padding: 10, width: 140 }}>Odstrel</th>
                  <th style={{ padding: 10, width: 110 }}>Pending</th>
                  <th style={{ padding: 10, width: 120 }}>%</th>
                  <th style={{ padding: 10, width: 90 }}>Status</th>
                  {/* ✅ edit column (empty header) */}
                  <th style={{ padding: 10, width: 80, textAlign: "right" }}></th>
                </tr>
              </thead>

              <tbody>
                {displayRows.map((r, idx) => {
                  if (r._type === "header") {
                    return (
                      <tr key={`h-${r.species}-${idx}`} style={{ borderTop: "2px solid rgba(107,78,46,.22)" }}>
                        <td style={{ padding: "12px 10px", fontWeight: 950, color: "#6B4E2E" }}>{r.species}</td>
                        <td colSpan={7} style={{ padding: "12px 10px", opacity: 0.55 }} />
                      </tr>
                    );
                  }

                  const isTotal = r._type === "total";
                  const plan = r.plan;
                  const executed = r.executed;
                  const pending = r.pending;

                  const hasOverride = !!r.override || (toNumOrNull(r.executedDelta) ?? 0) !== 0;

                  // ✅ show pencil only when editMode ON and row is editable (detail + total)
                  const canEditRow = editMode && r._type !== "header" && !!r.key;

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
                        {hasOverride && (
                          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 900, color: "#B24A3B" }}>
                            (popravljeno)
                          </span>
                        )}
                      </td>

                      <td style={{ padding: 10, fontWeight: isTotal ? 950 : 800 }}>{fmtNum(plan)}</td>

                      <td style={{ padding: 10, fontWeight: isTotal ? 950 : 800 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span>{fmtNum(executed)}</span>
                          {hasOverride && (
                            <span style={{ fontSize: 12, opacity: 0.65 }}>
                              auto {fmtNum(r.executedAuto)} {r.executedDelta ? `(Δ ${fmtNum(r.executedDelta)})` : ""}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: 10, fontWeight: isTotal ? 950 : 800 }}>{fmtNum(pending)}</td>
                      <td style={{ padding: 10, fontWeight: 950, color: "#6B4E2E" }}>{pct(executed, plan)}</td>
                      <td style={{ padding: 10, fontWeight: 950 }}>{statusIcon(plan, executed)}</td>

                      {/* ✅ tiny pencil button, only in editMode */}
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {canEditRow ? (
                          <button
                            title="Uredi odstrel"
                            onClick={() => openEdit(r)}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              border: "1px solid rgba(107,78,46,.22)",
                              background: "rgba(107,78,46,.08)",
                              color: "#6B4E2E",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <IconPencil size={16} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Prikaz: pri vsaki divjadi je samo 1× “Skupaj”. Skriti so “skupaj moški/ženski …”, da je tabela bolj
              zračna. Urejanje nastavi “končni Odstrel”, sistem shrani delta popravek.
            </div>
          </div>
        )}
      </div>

      {/* ===== NEW minimal modal ===== */}
      <ConfirmModal open={editOpen} title="Popravek odstrela" onClose={closeEdit} busy={savingEdit}>
        <div style={{ opacity: 0.85, marginBottom: 10 }}>
          <div style={{ fontWeight: 900 }}>{editRow?.species || "—"}</div>
          <div style={{ fontSize: 13, color: "rgba(0,0,0,.65)" }}>{editRow?.classLabel || "—"}</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Auto: {fmtNum(editRow?.executedAuto)}{" "}
            {(toNumOrNull(editRow?.executedDelta) ?? 0) !== 0 ? ` • Trenutni Δ ${fmtNum(editRow?.executedDelta)}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div className="label">Odstrel (popravek)</div>
            <input
              className="input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="npr. 3"
              style={{ height: 54 }}
              disabled={savingEdit}
            />
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>Namig: vpiši 0, če želiš “nič”.</div>
          </div>

          <button
            onClick={resetEdit}
            disabled={savingEdit}
            style={{
              height: 54,
              borderRadius: 12,
              padding: "0 14px",
              border: "1px solid rgba(107,78,46,.25)",
              background: "transparent",
              color: "#6B4E2E",
              fontWeight: 900,
              cursor: savingEdit ? "not-allowed" : "pointer",
            }}
          >
            Razveljavi
          </button>

          <button
            onClick={saveEdit}
            disabled={savingEdit}
            style={{
              height: 54,
              borderRadius: 12,
              padding: "0 16px",
              border: "1px solid rgba(107,78,46,.25)",
              background: "#6B4E2E",
              color: "white",
              fontWeight: 950,
              cursor: savingEdit ? "not-allowed" : "pointer",
            }}
          >
            {savingEdit ? "Shranjujem…" : "Shrani"}
          </button>
        </div>
      </ConfirmModal>
    </div>
  );
}
