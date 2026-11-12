// src/BoardMotions.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import RichTextEditor, { toEditorHtml } from "./RichTextEditor.jsx";
import Modal, { Field } from "./components/DraggableModal.jsx";

const MOTION_STATUS_META = {
  predlog: { label: "Predlog", color: "#8a6d3b", bg: "rgba(202,163,94,.18)" },
  razprava: { label: "V razpravi", color: "#2b6fae", bg: "rgba(43,111,174,.14)" },
  sprejeto: { label: "Sprejeto", color: "#1d6f42", bg: "rgba(46,160,90,.15)" },
  zavrnjeno: { label: "Zavrnjeno", color: "#a3372f", bg: "rgba(200,60,50,.15)" },
  umaknjeno: { label: "Umaknjeno", color: "#3a3a3a", bg: "rgba(58,58,58,.12)" },
};

const FINAL = ["sprejeto", "zavrnjeno", "umaknjeno"];
const FINAL_VERB = { sprejeto: "Sprejmi", zavrnjeno: "Zavrni", umaknjeno: "Umakni" };

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts === "string") return new Date(ts);
  const sec = ts._seconds ?? ts.seconds;
  return sec ? new Date(sec * 1000) : null;
}

function tsLabel(ts) {
  const d = tsToDate(ts);
  return d && !isNaN(d) ? d.toLocaleString("sl-SI") : "—";
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI");
  } catch {
    return "—";
  }
}

/* ================= LIST ================= */

export default function BoardMotions({ me }) {
  const [motions, setMotions] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("open"); // open | closed | all
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [mo, me2] = await Promise.all([api("/board/motions"), api("/board/meetings")]);
      setMotions(Array.isArray(mo?.motions) ? mo.motions : []);
      setMeetings(Array.isArray(me2?.meetings) ? me2.meetings : []);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function meetingLabel(meetingId) {
    if (!meetingId) return "Brez seje";
    const m = meetings.find((x) => x.id === meetingId);
    return m ? `Seja: ${fmt(m.datum)}` : "Povezana seja";
  }

  const visible = useMemo(() => {
    let list = motions;
    if (filter === "open") list = motions.filter((m) => !FINAL.includes(m.status));
    if (filter === "closed") list = motions.filter((m) => FINAL.includes(m.status));
    return [...list].sort((a, b) => {
      const da = tsToDate(a.zadnjaSpremembaDatum)?.getTime() || 0;
      const db = tsToDate(b.zadnjaSpremembaDatum)?.getTime() || 0;
      return db - da;
    });
  }, [motions, filter]);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ["open", "V obravnavi"],
            ["closed", "Zaključeni"],
            ["all", "Vsi"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                border: "1px solid " + (filter === key ? "#6B4E2E" : "rgba(107,78,46,.25)"),
                background: filter === key ? "rgba(107,78,46,.15)" : "transparent",
                color: "#6B4E2E",
                borderRadius: 999,
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="btn-mini"
          onClick={() => setEditing({ id: null, meetingId: null, naslov: "" })}
        >
          + Nov odlok
        </button>
      </div>

      {err && (
        <div className="error" style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {loading ? (
        <div className="desc">Nalagam...</div>
      ) : visible.length === 0 ? (
        <div className="desc">
          {motions.length === 0 ? "Ni še nobenega odloka. Dodaj prvega zgoraj." : "Ni odlokov v tem pogledu."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((mo) => {
            const meta = MOTION_STATUS_META[mo.status] || MOTION_STATUS_META.predlog;
            return (
              <div
                key={mo.id}
                className="login-card"
                onClick={() => setEditing({ id: mo.id, meetingId: mo.meetingId, naslov: mo.naslov })}
                style={{
                  padding: 14,
                  border: "1px solid rgba(107,78,46,.18)",
                  background: "rgba(255,255,255,.75)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, color: "#6B4E2E", fontSize: 14 }}>{mo.naslov}</div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                    {meetingLabel(mo.meetingId)} · 💬 {mo.steviloKomentarjev || 0} · verzija{" "}
                    {mo.verzija || 1}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "3px 9px",
                    borderRadius: 999,
                    color: meta.color,
                    background: meta.bg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <MotionEditorModal
          initial={editing}
          meetings={meetings}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ================= EDITOR ================= */

function MotionEditorModal({ initial, meetings, onClose }) {
  const [id, setId] = useState(initial.id);
  const [naslov, setNaslov] = useState(initial.naslov || "");
  const [meetingId, setMeetingId] = useState(initial.meetingId || "");
  const [vsebina, setVsebina] = useState("");
  const [status, setStatus] = useState("predlog");
  const [verzija, setVerzija] = useState(0);
  const [meta, setMeta] = useState({});

  const [loading, setLoading] = useState(!!initial.id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");
  const [confirmFinal, setConfirmFinal] = useState(null);

  const locked = FINAL.includes(status);

  async function load(targetId) {
    setLoading(true);
    setErr("");
    try {
      const out = await api(`/board/motions/${targetId}`);
      const m = out?.motion;
      if (m) {
        setId(m.id);
        setNaslov(m.naslov || "");
        setMeetingId(m.meetingId || "");
        setVsebina(m.vsebina || "");
        setStatus(m.status || "predlog");
        setVerzija(m.verzija || 1);
        setMeta({
          zadnjaSpremembaByName: m.zadnjaSpremembaByName,
          zakljucilByName: m.zakljucilByName,
          zakljucenDatum: m.zakljucenDatum,
          izvirnikId: m.izvirnikId || null,
        });
      }
      setDirty(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial.id) load(initial.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestClose() {
    if (dirty && !window.confirm("Imaš neshranjene spremembe. Zapri brez shranjevanja?")) return;
    onClose();
  }

  async function save() {
    if (!naslov.trim()) {
      setErr("Naslov je obvezen.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const body = { naslov, meetingId: meetingId || null, vsebina, status };
      if (!id) {
        const out = await api("/board/motions", { method: "POST", body });
        setId(out.id);
        setVerzija(1);
      } else {
        const out = await api(`/board/motions/${id}`, {
          method: "PATCH",
          body: { ...body, verzija },
        });
        setVerzija(out?.verzija || verzija);
      }
      setDirty(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function finalize(target) {
    setConfirmFinal(null);
    if (!naslov.trim()) {
      setErr("Naslov je obvezen.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api(`/board/motions/${id}`, {
        method: "PATCH",
        body: { naslov, meetingId: meetingId || null, vsebina, status: target, verzija },
      });
      await load(id);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function makeCopy() {
    setSaving(true);
    setErr("");
    try {
      const out = await api(`/board/motions/${id}/copy`, { method: "POST", body: {} });
      await load(out.id);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const linkedMeeting = meetingId ? meetings.find((m) => m.id === meetingId) : null;
  const finalMeta = MOTION_STATUS_META[status] || MOTION_STATUS_META.predlog;

  return (
    <Modal
      title={locked ? `Odlok (${finalMeta.label.toLowerCase()})` : id ? "Uredi odlok" : "Nov odlok"}
      onClose={requestClose}
      width={1000}
    >
      {loading ? (
        <div className="desc">Nalagam...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {locked ? (
            <>
              <style>{`
                .rte-readonly { padding: 14px 16px; border: 1px solid rgba(107,78,46,.15); border-radius: 12px; background: rgba(255,255,255,.7); line-height: 1.55; font-size: 14px; color: #2b2013; max-height: 40vh; overflow-y: auto; }
                .rte-readonly p, .rte-readonly div { margin: 0 0 8px; }
                .rte-readonly h1, .rte-readonly h2 { font-size: 20px; margin: 14px 0 6px; color: #6B4E2E; }
                .rte-readonly h3, .rte-readonly h4 { font-size: 16px; margin: 12px 0 6px; color: #6B4E2E; }
                .rte-readonly ul, .rte-readonly ol { margin: 4px 0 8px 22px; padding: 0; }
              `}</style>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: finalMeta.bg,
                  color: finalMeta.color,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <span>
                  🔒 {finalMeta.label}: {meta.zakljucilByName || "—"}, {tsLabel(meta.zakljucenDatum)}
                </span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>verzija {verzija}</span>
              </div>

              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#6B4E2E" }}>{naslov}</div>
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                  {linkedMeeting
                    ? `Seja: ${fmt(linkedMeeting.datum)}${linkedMeeting.lokacija ? ` — ${linkedMeeting.lokacija}` : ""}`
                    : meetingId
                    ? "Povezana seja"
                    : "Brez seje"}
                  {meta.izvirnikId ? " · popravek prejšnjega odloka" : ""}
                </div>
              </div>

              <div className="rte-readonly" dangerouslySetInnerHTML={{ __html: toEditorHtml(vsebina) }} />

              <div style={{ fontSize: 12, opacity: 0.65 }}>
                Zaključenega odloka ni mogoče spreminjati ali brisati, razprava je zaprta. Če je potreben
                popravek, ustvari popravljen odlok: nov predlog, original pa ostane nespremenjen.
              </div>
            </>
          ) : (
            <>
              <Field label="Naslov">
                <input
                  className="input"
                  type="text"
                  value={naslov}
                  onChange={(e) => {
                    setNaslov(e.target.value);
                    setDirty(true);
                  }}
                  style={{ width: "100%" }}
                  autoFocus
                />
              </Field>

              <Field label="Povezana seja (neobvezno)">
                <select
                  className="input"
                  value={meetingId || ""}
                  onChange={(e) => {
                    setMeetingId(e.target.value);
                    setDirty(true);
                  }}
                  style={{ width: "100%" }}
                >
                  <option value="">Brez seje</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {fmt(m.datum)} {m.lokacija ? `— ${m.lokacija}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {["predlog", "razprava"].map((key) => {
                  const m = MOTION_STATUS_META[key];
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setStatus(key);
                        setDirty(true);
                      }}
                      style={{
                        border: "1px solid " + (status === key ? m.color : "rgba(0,0,0,.15)"),
                        background: status === key ? m.bg : "transparent",
                        color: status === key ? m.color : "#666",
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
                <span style={{ fontSize: 11, opacity: 0.5, marginLeft: "auto" }}>
                  {verzija > 0 ? `verzija ${verzija}` : ""}
                  {meta.zadnjaSpremembaByName ? ` · zadnji uredil: ${meta.zadnjaSpremembaByName}` : ""}
                  {dirty ? " · neshranjeno" : ""}
                </span>
              </div>

              <RichTextEditor
                value={vsebina}
                onChange={(html) => {
                  setVsebina(html);
                  setDirty(true);
                }}
                placeholder="Besedilo odloka..."
                minHeight={300}
              />
            </>
          )}

          {err && (
            <div className="error" style={{ whiteSpace: "pre-wrap" }}>
              {err}
            </div>
          )}

          {confirmFinal && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "rgba(202,163,94,.15)",
                border: "1px solid rgba(202,163,94,.5)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#8a6d3b" }}>
                {`Ko odlok označiš kot "${MOTION_STATUS_META[confirmFinal].label}", ga ni več mogoče spreminjati, brisati ali odkleniti, razprava pa se zapre. Popravek je možen samo kot nov odlok. Nadaljujem?`}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setConfirmFinal(null)}>
                  Prekliči
                </button>
                <button className="btn-mini" onClick={() => finalize(confirmFinal)} disabled={saving}>
                  Da, nadaljuj
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-ghost" onClick={requestClose}>
              Zapri
            </button>
            {locked ? (
              <button className="btn-mini" onClick={makeCopy} disabled={saving}>
                {saving ? "Ustvarjam…" : "Ustvari popravljen odlok"}
              </button>
            ) : (
              <>
                <button className="btn-mini" onClick={save} disabled={saving}>
                  {saving ? "Shranjujem…" : id ? "Shrani spremembe" : "Ustvari odlok"}
                </button>
                {id &&
                  FINAL.map((f) => (
                    <button
                      key={f}
                      className="btn-ghost"
                      onClick={() => setConfirmFinal(f)}
                      disabled={saving || !!confirmFinal}
                      style={{ color: MOTION_STATUS_META[f].color }}
                    >
                      {FINAL_VERB[f]}
                    </button>
                  ))}
              </>
            )}
          </div>

          {id ? (
            <Discussion motionId={id} closed={locked} motionVerzija={verzija} />
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Razprava se odpre, ko odlok shraniš.</div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ================= DISCUSSION ================= */

function Discussion({ motionId, closed, motionVerzija }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);

  async function load() {
    setErr("");
    try {
      const out = await api(`/board/motions/${motionId}/comments`);
      setComments(Array.isArray(out?.comments) ? out.comments : []);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionId]);

  const { roots, repliesByRoot } = useMemo(() => {
    const r = [];
    const map = {};
    for (const c of comments) {
      if (c.odgovorNaId) {
        if (!map[c.odgovorNaId]) map[c.odgovorNaId] = [];
        map[c.odgovorNaId].push(c);
      } else {
        r.push(c);
      }
    }
    return { roots: r, repliesByRoot: map };
  }, [comments]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setErr("");
    try {
      await api(`/board/motions/${motionId}/comments`, {
        method: "POST",
        body: { besedilo: text, odgovorNaId: replyTo?.id || null },
      });
      setText("");
      setReplyTo(null);
      await load();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid rgba(107,78,46,.18)", paddingTop: 14 }}>
      <div style={{ fontWeight: 900, color: "#6B4E2E", fontSize: 14, marginBottom: 10 }}>
        Razprava ({comments.length})
      </div>

      {loading ? (
        <div className="desc">Nalagam...</div>
      ) : roots.length === 0 ? (
        <div className="desc">Še ni komentarjev.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {roots.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <CommentBox
                c={c}
                motionVerzija={motionVerzija}
                onReply={closed ? null : () => setReplyTo(c)}
              />
              {(repliesByRoot[c.id] || []).map((r) => (
                <div key={r.id} style={{ marginLeft: 24 }}>
                  <CommentBox c={r} motionVerzija={motionVerzija} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {err && (
        <div className="error" style={{ marginBottom: 10, whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {closed ? (
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Razprava je zaprta, ker je odlok zaključen. Komentarji so trajni in jih ni mogoče
          spreminjati.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {replyTo && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Odgovor na komentar: {replyTo.avtorName}{" "}
              <button className="btn-ghost" style={{ padding: "0 6px" }} onClick={() => setReplyTo(null)}>
                prekliči
              </button>
            </div>
          )}
          <textarea
            className="input"
            rows={3}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? "Napiši odgovor..." : "Napiši komentar ali predlagaj spremembo..."}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, opacity: 0.5 }}>
              Komentarjev po objavi ni mogoče urejati ali brisati.
            </span>
            <button className="btn-mini" onClick={send} disabled={sending || !text.trim()}>
              {sending ? "Pošiljam…" : replyTo ? "Odgovori" : "Dodaj komentar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentBox({ c, motionVerzija, onReply }) {
  const oldVersion = c.odlokVerzija && c.odlokVerzija < motionVerzija;
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(107,78,46,.05)",
        border: "1px solid rgba(107,78,46,.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 11,
          opacity: 0.75,
          marginBottom: 4,
        }}
      >
        <span style={{ fontWeight: 800 }}>{c.avtorName || c.avtorCode}</span>
        <span>
          {tsLabel(c.createdAt)}
          {oldVersion ? ` · pisano ob verziji ${c.odlokVerzija}` : ""}
        </span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap", color: "#2b2013" }}>
        {c.besedilo}
      </div>
      {onReply && (
        <button
          className="btn-ghost"
          onClick={onReply}
          style={{ padding: "2px 6px", fontSize: 11, marginTop: 4 }}
        >
          Odgovori
        </button>
      )}
    </div>
  );
}