// src/DocumentsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { api, API_BASE, getToken } from "./api.js";

function isStaffRole(role) {
  const r = String(role || "").trim();
  return r === "super" || r === "admin" || r === "moderator";
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI");
  } catch {
    return "—";
  }
}

function niceErr(e) {
  const msg = e?.message || String(e || "");
  if (typeof e === "object" && e?.error) {
    const detail = e?.detail ? `\n${e.detail}` : "";
    return `${e.error}${detail}`;
  }
  return msg;
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

function categoryLabel(v) {
  const s = String(v || "").trim();
  if (!s) return "Splošno";
  return s;
}

export default function DocumentsPage({ me, onBackHome }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState("");
  const [err, setErr] = useState("");
  const [docs, setDocs] = useState([]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Splošno");
  const [description, setDescription] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [filterCategory, setFilterCategory] = useState("ALL");

  const canEdit = useMemo(() => isStaffRole(me?.role), [me?.role]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const out = await api("/ld/documents");
      setDocs(Array.isArray(out?.documents) ? out.documents : []);
    } catch (e) {
      setDocs([]);
      setErr(niceErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    docs.forEach((d) => set.add(categoryLabel(d.category)));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b, "sl"))];
  }, [docs]);

  const filteredDocs = useMemo(() => {
    if (filterCategory === "ALL") return docs;
    return docs.filter((d) => categoryLabel(d.category) === filterCategory);
  }, [docs, filterCategory]);

  async function createDocument() {
    if (!canEdit) return;

    const t = String(title || "").trim();
    const c = String(category || "").trim() || "Splošno";
    const desc = String(description || "").trim();

    if (!t) return setErr("Vpiši naslov dokumenta.");
    if (!docFile) return setErr("Izberi datoteko.");

    const ok = window.confirm("Ali res želiš naložiti dokument?");
    if (!ok) return;

    setSaving(true);
    setErr("");

    try {
      if (docFile.size > 10 * 1024 * 1024) {
        throw new Error("Datoteka je prevelika. Max 10MB.");
      }

      const b64 = await fileToBase64(docFile);

      await api("/ld/documents", {
        method: "POST",
        body: {
          title: t,
          category: c,
          description: desc,
          filename: docFile.name,
          mime: docFile.type || "application/octet-stream",
          contentBase64: b64,
        },
      });

      setTitle("");
      setCategory("Splošno");
      setDescription("");
      setDocFile(null);

      const fileInput = document.getElementById("rog-doc-upload-input");
      if (fileInput) fileInput.value = "";

      await load();
    } catch (e) {
      setErr(niceErr(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(id, titleText) {
    if (!canEdit) return;

    const ok = window.confirm(`Ali res želiš izbrisati dokument "${titleText || "dokument"}"?`);
    if (!ok) return;

    setSaving(true);
    setErr("");

    try {
      await api(`/ld/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      setErr(niceErr(e));
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(doc) {
    setErr("");
    setOpeningId(doc.id || "");

    try {
      const token = getToken();
      if (!token) {
        throw new Error("Manjka prijavni token.");
      }

      const res = await fetch(`${API_BASE}/ld/documents/${encodeURIComponent(doc.id)}/download`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let msg = `Napaka pri odpiranju dokumenta (HTTP ${res.status})`;
        try {
          const text = await res.text();
          if (text) msg = text;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");

      // po kratkem sprosti object URL
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60_000);
    } catch (e) {
      setErr(niceErr(e));
    } finally {
      setOpeningId("");
    }
  }

  return (
    <div>
      <div className="stat" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="desc" style={{ marginTop: 2 }}>
              Pomembni dokumenti lovske družine: pravilniki, obrazci, zapisniki, navodila in druge priloge.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {onBackHome && (
              <button className="btn-mini" onClick={onBackHome} disabled={saving}>
                Nazaj
              </button>
            )}
            <button className="btn-mini" onClick={load} disabled={saving || loading}>
              Osveži
            </button>
          </div>
        </div>

        {err && (
          <div className="error" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {err}
          </div>
        )}

        {canEdit && (
          <div
            className="login-card"
            style={{
              marginTop: 14,
              padding: 16,
              width: "min(980px, 100%)",
              marginLeft: "auto",
              marginRight: "auto",
              border: "1px solid rgba(107,78,46,.18)",
              background: "rgba(255,255,255,.72)",
            }}
          >
            <div style={{ fontWeight: 950, color: "#6B4E2E", marginBottom: 10 }}>
              Naloži dokument
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="label">Naslov *</div>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ height: 48 }}
                  placeholder="npr. Pravilnik o varnosti"
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="label">Kategorija</div>
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ height: 48 }}
                >
                  <option value="Splošno">Splošno</option>
                  <option value="Pravilniki">Pravilniki</option>
                  <option value="Obrazci">Obrazci</option>
                  <option value="Zapisniki">Zapisniki</option>
                  <option value="Razpisi">Razpisi</option>
                  <option value="Navodila">Navodila</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="label">Opis (neobvezno)</div>
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  height: "auto",
                  paddingTop: 10,
                  paddingBottom: 10,
                  resize: "vertical",
                }}
                placeholder="Kratek opis dokumenta ..."
              />
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "end",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 280, flex: 1 }}>
                <div className="label">Datoteka *</div>
                <input
                  id="rog-doc-upload-input"
                  className="input"
                  type="file"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  style={{ height: 48, paddingTop: 10 }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                />
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  (PDF/DOC/DOCX/XLS/XLSX – max 10MB)
                </div>
              </div>

              <button className="btn-mini" onClick={createDocument} disabled={saving} style={{ height: 48 }}>
                {saving ? "Nalagam..." : "Naloži dokument"}
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="label" style={{ margin: 0 }}>
            Filter kategorije
          </div>
          <select
            className="input"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ height: 42, width: 220 }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "Vse kategorije" : c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 14 }}>
          {loading ? (
            <div className="desc">Nalagam...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="desc">Ni dokumentov.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead style={{ background: "rgba(250,250,250,0.95)" }}>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: 10 }}>Naslov</th>
                    <th style={{ padding: 10, width: 160 }}>Kategorija</th>
                    <th style={{ padding: 10 }}>Opis</th>
                    <th style={{ padding: 10, width: 180 }}>Datoteka</th>
                    <th style={{ padding: 10, width: 180 }}>Naloženo</th>
                    <th style={{ padding: 10, width: 180, textAlign: "right" }}>Akcije</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDocs.map((d) => (
                    <tr key={d.id} style={{ borderTop: "1px solid rgba(107,78,46,.14)" }}>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 950, color: "#6B4E2E" }}>{d.title || "—"}</div>
                      </td>

                      <td style={{ padding: 10 }}>{categoryLabel(d.category)}</td>

                      <td style={{ padding: 10 }}>
                        {d.description ? (
                          <div style={{ opacity: 0.8, whiteSpace: "pre-wrap" }}>{d.description}</div>
                        ) : (
                          <span style={{ opacity: 0.6 }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 700 }}>{d.filename || "—"}</div>
                        {d.mime ? (
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>{d.mime}</div>
                        ) : null}
                      </td>

                      <td style={{ padding: 10 }}>{fmt(d.createdAt)}</td>

                      <td style={{ padding: 10, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <span
                            onClick={() => openDocument(d)}
                            style={{
                              cursor: openingId === d.id ? "wait" : "pointer",
                              fontSize: 18,
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(107,78,46,.25)",
                              background:
                                "linear-gradient(180deg, rgba(239,230,214,.6), rgba(255,255,255,.9))",
                              color: "#6B4E2E",
                              fontWeight: 900,
                              opacity: openingId === d.id ? 0.6 : 1,
                              userSelect: "none",
                            }}
                            title="Odpri dokument"
                          >
                            📎
                          </span>

                          {canEdit && (
                            <button
                              className="btn-ghost"
                              onClick={() => deleteDocument(d.id, d.title)}
                              style={{
                                borderColor: "rgba(200,0,0,.25)",
                                color: "#a01515",
                              }}
                            >
                              Izbriši
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Opomba: moderator ali admin lahko nalaga in briše dokumente. Vsi prijavljeni uporabniki jih lahko odprejo.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}