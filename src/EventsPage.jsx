// src/EventsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI");
  } catch {
    return "—";
  }
}

function isStaffRole(role) {
  const r = String(role || "");
  return r === "super" || r === "moderator" || r === "admin";
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

function niceErr(e) {
  const msg = e?.message || String(e || "");
  // če api wrapper vrne JSON {error, detail}
  if (typeof e === "object" && e?.error) {
    const detail = e?.detail ? `\n${e.detail}` : "";
    return `${e.error}${detail}`;
  }
  return msg;
}

export default function EventsPage({ me, onBackHome }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [events, setEvents] = useState([]);

  const canEdit = useMemo(() => isStaffRole(me?.role), [me?.role]);

  // create form
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // attachments (optional)
  const [attachFile, setAttachFile] = useState(null);

  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const out = await api(`/ld/events?future=1&limit=500`);
      setEvents(Array.isArray(out?.events) ? out.events : []);
    } catch (e) {
      setEvents([]);
      setErr(niceErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createEvent() {
    if (!canEdit) return;

    const t = String(title || "").trim();
    if (!t) return setErr("Vpiši naslov dogodka.");
    if (!startsAt) return setErr("Izberi datum/uro začetka.");

    const ok = window.confirm("Ali res želiš dodati dogodek?");
    if (!ok) return;

    setSaving(true);
    setErr("");

    try {
      // 1) ustvari event
      const startsIso = new Date(startsAt).toISOString();
      const created = await api("/ld/events", {
        method: "POST",
        body: {
          title: t,
          startsAt: startsIso,
          location: String(location || "").trim(),
          description: String(description || "").trim(),
        },
      });

      const eventId = created?.id;
      if (!eventId) throw new Error("Manjka id dogodka (backend ni vrnil id).");

      // 2) če je priloga -> upload na /attachment
      if (attachFile) {
        // basic size guard (10MB)
        if (attachFile.size > 10 * 1024 * 1024) {
          throw new Error("Datoteka je prevelika. Max 10MB.");
        }

        const b64 = await fileToBase64(attachFile);

        await api(`/ld/events/${encodeURIComponent(eventId)}/attachment`, {
          method: "POST",
          body: {
            filename: attachFile.name,
            mime: attachFile.type || "application/octet-stream",
            contentBase64: b64,
          },
        });
      }

      // reset form
      setTitle("");
      setStartsAt("");
      setLocation("");
      setDescription("");
      setAttachFile(null);

      // reload list
      await load();
    } catch (e) {
      setErr(niceErr(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id) {
    if (!canEdit) return;
    const ok = window.confirm("Ali res želiš izbrisati dogodek?");
    if (!ok) return;

    setSaving(true);
    setErr("");
    try {
      await api(`/ld/events/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(niceErr(e));
    } finally {
      setSaving(false);
    }
  }

  async function importEventsFile() {
    if (!canEdit) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.json";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const ok = window.confirm("Import dogodkov? (CSV/JSON)");
      if (!ok) return;

      setSaving(true);
      setErr("");
      try {
        const b64 = await fileToBase64(file);
        await api("/ld/events/import", {
          method: "POST",
          body: { filename: file.name, contentBase64: b64 },
        });
        await load();
      } catch (e) {
        setErr(niceErr(e));
      } finally {
        setSaving(false);
      }
    };

    input.click();
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
              Dogodki in obvestila lovske družine (občni zbor, tekme, sestanki…).
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canEdit && (
              <button className="btn-mini" onClick={importEventsFile} disabled={saving}>
                Import (CSV/JSON)
              </button>
            )}

            {onBackHome && (
              <button className="btn-mini" onClick={onBackHome} disabled={saving}>
                Nazaj
              </button>
            )}
          </div>
        </div>

        {err && (
          <div className="error" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {err}
          </div>
        )}

        {/* CREATE FORM */}
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
              Dodaj dogodek
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="label">Naslov</div>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ height: 48 }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="label">Začetek</div>
                <input
                  className="input"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  style={{ height: 48 }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="label">Lokacija</div>
                <input
                  className="input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ height: 48 }}
                />
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
                placeholder="npr. Dnevni red, opombe, pravila tekme ..."
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
              <div style={{ minWidth: 260, flex: 1 }}>
                <div className="label">Priloga (neobvezno)</div>
                <input
                  className="input"
                  type="file"
                  onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  style={{ height: 48, paddingTop: 10 }}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                />
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  (PDF/DOC/DOCX – npr. vabilo, razpis, zapisnik… max 10MB)
                </div>
              </div>

              <button className="btn-mini" onClick={createEvent} disabled={saving} style={{ height: 48 }}>
                {saving ? "Shranjujem..." : "Dodaj"}
              </button>
            </div>
          </div>
        )}

        {/* LIST */}
        <div style={{ marginTop: 14 }}>
          {loading ? (
            <div className="desc">Nalagam...</div>
          ) : events.length === 0 ? (
            <div className="desc">Ni dogodkov.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead style={{ background: "rgba(250,250,250,0.95)" }}>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: 10, width: 200 }}>Začetek</th>
                    <th style={{ padding: 10 }}>Dogodek</th>
                    <th style={{ padding: 10, width: 220 }}>Lokacija</th>
                    <th style={{ padding: 10, width: 240 }}>Priloge</th>
                    <th style={{ padding: 10, width: 120, textAlign: "right" }}></th>
                  </tr>
                </thead>

                <tbody>
                  {events.map((e) => {
                    const atts = Array.isArray(e.attachments) ? e.attachments : [];
                    return (
                      <tr key={e.id} style={{ borderTop: "1px solid rgba(107,78,46,.14)" }}>
                        <td style={{ padding: 10, fontWeight: 900 }}>{fmt(e.startsAt)}</td>

                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 950, color: "#6B4E2E" }}>{e.title || "—"}</div>
                          {!!e.description && (
                            <div
                              style={{
                                marginTop: 4,
                                opacity: 0.75,
                                fontSize: 13,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {e.description}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: 10, opacity: 0.8 }}>{e.location || "—"}</td>

                        <td style={{ padding: 10 }}>
                          {atts.length === 0 ? (
                            <span style={{ opacity: 0.6 }}>—</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {atts.map((a, idx) => (
                                <a
                                  key={`${e.id}_${idx}`}
                                  href={a?.url || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 10px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(107,78,46,.25)",
                                    background: "rgba(255,255,255,.7)",
                                    color: "#6B4E2E",
                                    fontWeight: 900,
                                    textDecoration: "none",
                                    width: "fit-content",
                                    maxWidth: "100%",
                                  }}
                                  title={a?.filename || "Priloga"}
                                  onClick={(ev) => {
                                    if (!a?.url) {
                                      ev.preventDefault();
                                      setErr("Priloga nima URL-ja (manjka a.url).");
                                    }
                                  }}
                                >
                                  📎 Odpri
                                  <span style={{ fontWeight: 700, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {a?.filename ? `(${a.filename})` : ""}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: 10, textAlign: "right" }}>
                          {canEdit ? (
                            <button className="btn-mini" onClick={() => deleteEvent(e.id)} disabled={saving}>
                              Izbriši
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
                Opomba: dogodke lahko dodaja/ureja moderator ali super/admin. Člani jih lahko gledajo.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}