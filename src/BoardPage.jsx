// src/BoardPage.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import RichTextEditor, { toEditorHtml } from "./RichTextEditor.jsx";
import BoardMotions from "./BoardMotions.jsx";

const STATUS_META = {
  nacrtovana: { label: "Načrtovana", color: "#8a6d3b", bg: "rgba(202,163,94,.18)" },
  v_teku: { label: "V teku", color: "#1d6f42", bg: "rgba(46,160,90,.18)" },
  zakljucena: { label: "Zaključena", color: "#3a3a3a", bg: "rgba(58,58,58,.12)" },
  preklicana: { label: "Preklicana", color: "#a3372f", bg: "rgba(200,60,50,.15)" },
};

const ATTENDANCE_META = {
  prisoten: { label: "Prisoten", color: "#1d6f42", bg: "rgba(46,160,90,.15)" },
  opravicen: { label: "Opravičen", color: "#8a6d3b", bg: "rgba(202,163,94,.18)" },
  odsoten: { label: "Odsoten", color: "#a3372f", bg: "rgba(200,60,50,.15)" },
};

const MINUTES_STATUS_META = {
  osnutek: { label: "Osnutek", color: "#a3372f", bg: "rgba(200,60,50,.15)" },
  v_potrjevanju: { label: "V potrjevanju", color: "#8a6d3b", bg: "rgba(202,163,94,.18)" },
  potrjen: { label: "Potrjen", color: "#1d6f42", bg: "rgba(46,160,90,.15)" },
};

const DAY_LABELS = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
const MONTH_LABELS = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December",
];

export default function BoardPage({ me }) {
  const [subTab, setSubTab] = useState("koledar"); // "koledar" | "zapisniki"

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <SubTabButton active={subTab === "koledar"} onClick={() => setSubTab("koledar")}>
          Koledar
        </SubTabButton>
        <SubTabButton active={subTab === "odloki"} onClick={() => setSubTab("odloki")}>
          Odloki
        </SubTabButton>
        <SubTabButton active={subTab === "zapisniki"} onClick={() => setSubTab("zapisniki")}>
          Zapisniki
        </SubTabButton>
      </div>

      {subTab === "koledar" && <KoledarView me={me} />}
      {subTab === "odloki" && <BoardMotions me={me} />}
      {subTab === "zapisniki" && <ZapisnikiView />}
    </>
  );
}

function SubTabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "1px solid " + (active ? "#6B4E2E" : "rgba(107,78,46,.25)"),
        background: active ? "#6B4E2E" : "transparent",
        color: active ? "#fff" : "#6B4E2E",
        borderRadius: 999,
        padding: "6px 16px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* ================= KOLEDAR VIEW ================= */

function KoledarView({ me }) {
  const [meetings, setMeetings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [modal, setModal] = useState(null);
  const [attendanceMeeting, setAttendanceMeeting] = useState(null);
  const [minutesPickerMeeting, setMinutesPickerMeeting] = useState(null);
  const [editingMinutes, setEditingMinutes] = useState(null); // {id, meetingId, naslov} or null

  const [datum, setDatum] = useState("");
  const [lokacija, setLokacija] = useState("");
  const [dnevniRed, setDnevniRed] = useState("");
  const [savingMeeting, setSavingMeeting] = useState(false);

  const [noteDatum, setNoteDatum] = useState("");
  const [noteNaslov, setNoteNaslov] = useState("");
  const [noteBesedilo, setNoteBesedilo] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const [mOut, nOut] = await Promise.all([
        api("/board/meetings"),
        api("/board/notes"),
      ]);
      setMeetings(Array.isArray(mOut?.meetings) ? mOut.meetings : []);
      setNotes(Array.isArray(nOut?.notes) ? nOut.notes : []);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openMeetingModal(prefillDay) {
    setDatum(prefillDay ? `${prefillDay}T19:00` : "");
    setLokacija("");
    setDnevniRed("");
    setModal("meeting");
  }

  function openNoteModal(prefillDay) {
    setNoteDatum(prefillDay || "");
    setNoteNaslov("");
    setNoteBesedilo("");
    setModal("note");
  }

  function closeModal() {
    setModal(null);
  }

  async function addMeeting(e) {
    e.preventDefault();
    if (!datum || savingMeeting) return;

    setSavingMeeting(true);
    setErr("");
    try {
      await api("/board/meetings", {
        method: "POST",
        body: { datum, lokacija, dnevniRed },
      });
      closeModal();
      await loadAll();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSavingMeeting(false);
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!noteDatum || !noteNaslov || savingNote) return;

    setSavingNote(true);
    setErr("");
    try {
      await api("/board/notes", {
        method: "POST",
        body: { datum: noteDatum, naslov: noteNaslov, besedilo: noteBesedilo },
      });
      closeModal();
      await loadAll();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSavingNote(false);
    }
  }

  const meetingsByDay = useMemo(() => {
    const map = {};
    for (const m of meetings) {
      if (!m.datum) continue;
      const key = dayKey(new Date(m.datum));
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    return map;
  }, [meetings]);

  const notesByDay = useMemo(() => {
    const map = {};
    for (const n of notes) {
      if (!n.datum) continue;
      const key = dayKey(new Date(n.datum));
      if (!map[key]) map[key] = [];
      map[key].push(n);
    }
    return map;
  }, [notes]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    let list = meetings;

    if (selectedDay) {
      list = meetings.filter((m) => m.datum && dayKey(new Date(m.datum)) === selectedDay);
    }

    const up = [];
    const pa = [];
    for (const m of list) {
      const t = m.datum ? new Date(m.datum).getTime() : 0;
      if (t >= now) up.push(m);
      else pa.push(m);
    }
    up.sort((a, b) => new Date(a.datum) - new Date(b.datum));
    pa.sort((a, b) => new Date(b.datum) - new Date(a.datum));
    return { upcoming: up, past: pa };
  }, [meetings, selectedDay]);

  const dayNotes = useMemo(() => {
    if (!selectedDay) return [];
    return notesByDay[selectedDay] || [];
  }, [selectedDay, notesByDay]);

  const nextMeeting = useMemo(() => {
    const now = Date.now();
    return meetings
      .filter((m) => m.datum && new Date(m.datum).getTime() >= now)
      .sort((a, b) => new Date(a.datum) - new Date(b.datum))[0] || null;
  }, [meetings]);

  const selectedDayIsEmpty =
    selectedDay && upcoming.length === 0 && past.length === 0 && dayNotes.length === 0;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <MiniStat
          title="Naslednja seja"
          value={nextMeeting ? fmtShort(nextMeeting.datum) : "—"}
          desc={nextMeeting ? nextMeeting.lokacija || "brez lokacije" : "ni načrtovane"}
        />
        <MiniStat title="Skupaj sej" value={String(meetings.length)} desc="v sistemu" />
        <MiniStat title="Opomb" value={String(notes.length)} desc="v koledarju" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 340px) 1fr",
          gap: 20,
          alignItems: "start",
          marginBottom: 20,
        }}
      >
        <div>
          <MiniCalendar
            month={calMonth}
            onPrevMonth={() => setCalMonth((m) => addMonths(m, -1))}
            onNextMonth={() => setCalMonth((m) => addMonths(m, 1))}
            meetingsByDay={meetingsByDay}
            notesByDay={notesByDay}
            selectedDay={selectedDay}
            onSelectDay={(key) =>
              setSelectedDay((cur) => (cur === key ? null : key))
            }
          />

          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            <span><Dot color="#a3372f" /> seja</span>
            <span><Dot color="#2b6fae" /> opomba</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn-mini" style={{ flex: 1 }} onClick={() => openMeetingModal(selectedDay)}>
              + Seja
            </button>
            <button className="btn-mini" style={{ flex: 1 }} onClick={() => openNoteModal(selectedDay)}>
              + Opomba
            </button>
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <h4 style={{ margin: 0 }}>
              {selectedDay ? `${fmtDayLabel(selectedDay)}` : "Seje upravnega odbora"}
            </h4>
            {selectedDay && (
              <button className="btn-mini" onClick={() => setSelectedDay(null)}>
                Prikaži vse
              </button>
            )}
          </div>

          {err && (
            <div className="error" style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>
              {err}
            </div>
          )}

          {selectedDay && dayNotes.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.6, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Opombe
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dayNotes.map((n) => (
                  <div
                    key={n.id}
                    className="login-card"
                    style={{ padding: 14, border: "1px solid rgba(43,111,174,.25)", background: "rgba(43,111,174,.06)" }}
                  >
                    <div style={{ fontWeight: 950, color: "#2b6fae", fontSize: 14 }}>{n.naslov}</div>
                    {n.besedilo && (
                      <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>{n.besedilo}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="desc">Nalagam...</div>
          ) : selectedDayIsEmpty ? (
            <div
              className="stat"
              style={{
                textAlign: "center",
                padding: 28,
                background: "rgba(255,255,255,.5)",
                border: "1px dashed rgba(107,78,46,.3)",
              }}
            >
              <div className="desc" style={{ marginBottom: 14 }}>
                Na ta dan še ni ničesar.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn-mini" onClick={() => openMeetingModal(selectedDay)}>
                  + Dodaj sejo ta dan
                </button>
                <button className="btn-mini" onClick={() => openNoteModal(selectedDay)}>
                  + Dodaj opombo ta dan
                </button>
              </div>
            </div>
          ) : upcoming.length === 0 && past.length === 0 ? (
            <div className="desc">Ni še nobene seje. Dodaj prvo zgoraj.</div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <MeetingSection
                  title="Prihajajoče"
                  meetings={upcoming}
                  onOpenAttendance={setAttendanceMeeting}
                  onOpenMinutesPicker={setMinutesPickerMeeting}
                />
              )}
              {past.length > 0 && (
                <MeetingSection
                  title="Pretekle"
                  meetings={past}
                  dim
                  onOpenAttendance={setAttendanceMeeting}
                  onOpenMinutesPicker={setMinutesPickerMeeting}
                />
              )}
            </>
          )}
        </div>
      </div>

      {modal === "meeting" && (
        <Modal title="Nova seja" onClose={closeModal}>
          <form onSubmit={addMeeting} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Datum in ura">
              <input
                className="input"
                type="datetime-local"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                required
                style={{ width: "100%" }}
                autoFocus
              />
            </Field>
            <Field label="Lokacija">
              <input
                className="input"
                type="text"
                placeholder="npr. Lovski dom"
                value={lokacija}
                onChange={(e) => setLokacija(e.target.value)}
                style={{ width: "100%" }}
              />
            </Field>
            <Field label="Dnevni red">
              <input
                className="input"
                type="text"
                placeholder="Kratek povzetek točk seje"
                value={dnevniRed}
                onChange={(e) => setDnevniRed(e.target.value)}
                style={{ width: "100%" }}
              />
            </Field>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>
                Prekliči
              </button>
              <button className="btn-mini" type="submit" disabled={savingMeeting}>
                {savingMeeting ? "Shranjujem…" : "Dodaj sejo"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "note" && (
        <Modal title="Nova opomba" onClose={closeModal}>
          <form onSubmit={addNote} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Datum">
              <input
                className="input"
                type="date"
                value={noteDatum}
                onChange={(e) => setNoteDatum(e.target.value)}
                required
                style={{ width: "100%" }}
                autoFocus
              />
            </Field>
            <Field label="Naslov">
              <input
                className="input"
                type="text"
                placeholder="npr. Rok za poročilo"
                value={noteNaslov}
                onChange={(e) => setNoteNaslov(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </Field>
            <Field label="Besedilo (neobvezno)">
              <input
                className="input"
                type="text"
                placeholder="Kratek opis"
                value={noteBesedilo}
                onChange={(e) => setNoteBesedilo(e.target.value)}
                style={{ width: "100%" }}
              />
            </Field>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>
                Prekliči
              </button>
              <button className="btn-mini" type="submit" disabled={savingNote}>
                {savingNote ? "Shranjujem…" : "Dodaj opombo"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {attendanceMeeting && (
        <AttendanceModal
          meeting={attendanceMeeting}
          onClose={() => setAttendanceMeeting(null)}
          myCode={me?.code}
        />
      )}

      {minutesPickerMeeting && (
        <MinutesPickerModal
          meeting={minutesPickerMeeting}
          onClose={() => setMinutesPickerMeeting(null)}
          onPick={(entry) => {
            setEditingMinutes(entry);
            setMinutesPickerMeeting(null);
          }}
        />
      )}

      {editingMinutes && (
        <MinutesEditorModal
          initial={editingMinutes}
          meetings={meetings}
          onClose={() => setEditingMinutes(null)}
        />
      )}
    </>
  );
}

/* ================= ZAPISNIKI VIEW (standalone list) ================= */

function ZapisnikiView() {
  const [minutesList, setMinutesList] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editingMinutes, setEditingMinutes] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [mnOut, mOut] = await Promise.all([
        api("/board/minutes"),
        api("/board/meetings"),
      ]);
      setMinutesList(Array.isArray(mnOut?.minutes) ? mnOut.minutes : []);
      setMeetings(Array.isArray(mOut?.meetings) ? mOut.meetings : []);
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
    return m ? fmt(m.datum) : "Povezana seja";
  }

  const sorted = useMemo(() => {
    return [...minutesList].sort((a, b) => {
      const da = a.zadnjaSpremembaDatum?._seconds || 0;
      const db = b.zadnjaSpremembaDatum?._seconds || 0;
      return db - da;
    });
  }, [minutesList]);

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
        <h4 style={{ margin: 0 }}>Vsi zapisniki</h4>
        <button
          className="btn-mini"
          onClick={() => setEditingMinutes({ id: null, meetingId: null, naslov: "" })}
        >
          + Nov zapisnik
        </button>
      </div>

      {err && (
        <div className="error" style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {loading ? (
        <div className="desc">Nalagam...</div>
      ) : sorted.length === 0 ? (
        <div className="desc">Ni še nobenega zapisnika. Dodaj prvega zgoraj.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((mn) => {
            const meta = MINUTES_STATUS_META[mn.status] || MINUTES_STATUS_META.osnutek;
            return (
              <div
                key={mn.id}
                className="login-card"
                onClick={() =>
                  setEditingMinutes({ id: mn.id, meetingId: mn.meetingId, naslov: mn.naslov })
                }
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
                  <div style={{ fontWeight: 900, color: "#6B4E2E", fontSize: 14 }}>{mn.naslov}</div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                    {meetingLabel(mn.meetingId)}
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

      {editingMinutes && (
        <MinutesEditorModal
          initial={editingMinutes}
          meetings={meetings}
          onClose={() => {
            setEditingMinutes(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ================= MINUTES PICKER (from a meeting card) ================= */

function MinutesPickerModal({ meeting, onClose, onPick }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const out = await api(`/board/minutes?meetingId=${encodeURIComponent(meeting.id)}`);
        if (alive) setList(Array.isArray(out?.minutes) ? out.minutes : []);
      } catch (e) {
        if (alive) setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [meeting.id]);

  const templateName = `Zapisnik — ${fmt(meeting.datum)}`;

  return (
    <Modal title={`Zapisniki — ${fmt(meeting.datum)}`} onClose={onClose}>
      {err && (
        <div className="error" style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {loading ? (
        <div className="desc">Nalagam...</div>
      ) : (
        <>
          {list.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {list.map((mn) => {
                const meta = MINUTES_STATUS_META[mn.status] || MINUTES_STATUS_META.osnutek;
                return (
                  <div
                    key={mn.id}
                    onClick={() => onPick({ id: mn.id, meetingId: mn.meetingId, naslov: mn.naslov })}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: "rgba(107,78,46,.05)",
                      cursor: "pointer",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#3a2c1a" }}>{mn.naslov}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        padding: "2px 8px",
                        borderRadius: 999,
                        color: meta.color,
                        background: meta.bg,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            className="btn-mini"
            style={{ width: "100%" }}
            onClick={() => onPick({ id: null, meetingId: meeting.id, naslov: templateName })}
          >
            + Nov zapisnik za to sejo
          </button>
        </>
      )}
    </Modal>
  );
}

/* ================= MINUTES EDITOR (create or edit; potrjen = read-only, brez odklepa) ================= */

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

function MinutesEditorModal({ initial, meetings, onClose }) {
  const [id, setId] = useState(initial.id);
  const [naslov, setNaslov] = useState(initial.naslov || "");
  const [meetingId, setMeetingId] = useState(initial.meetingId || "");
  const [vsebina, setVsebina] = useState("");
  const [status, setStatus] = useState("osnutek");
  const [verzija, setVerzija] = useState(0);
  const [meta, setMeta] = useState({});

  const [loading, setLoading] = useState(!!initial.id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");

  const [confirmApprove, setConfirmApprove] = useState(false);

  const locked = status === "potrjen";

  async function load(targetId) {
    setLoading(true);
    setErr("");
    try {
      const out = await api(`/board/minutes/${targetId}`);
      const m = out?.minutes;
      if (m) {
        setId(m.id);
        setNaslov(m.naslov || "");
        setMeetingId(m.meetingId || "");
        setVsebina(m.vsebina || "");
        setStatus(m.status || "osnutek");
        setVerzija(m.verzija || 0);
        setMeta({
          potrdilByName: m.potrdilByName,
          potrdilDatum: m.potrdilDatum,
          zadnjaSpremembaByName: m.zadnjaSpremembaByName,
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
        const out = await api("/board/minutes", { method: "POST", body });
        setId(out.id);
        setVerzija(1);
      } else {
        const out = await api(`/board/minutes/${id}`, { method: "PATCH", body });
        setVerzija(out?.verzija || verzija);
      }
      setDirty(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setConfirmApprove(false);
    if (!naslov.trim()) {
      setErr("Naslov je obvezen.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      let targetId = id;
      if (!targetId) {
        const created = await api("/board/minutes", {
          method: "POST",
          body: { naslov, meetingId: meetingId || null, vsebina, status: "osnutek" },
        });
        targetId = created.id;
        setId(targetId);
      }
      await api(`/board/minutes/${targetId}`, {
        method: "PATCH",
        body: { naslov, meetingId: meetingId || null, vsebina, status: "potrjen" },
      });
      await load(targetId);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function makeCorrection() {
    setSaving(true);
    setErr("");
    try {
      const out = await api(`/board/minutes/${id}/copy`, { method: "POST", body: {} });
      await load(out.id);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const linkedMeeting = meetingId ? meetings.find((m) => m.id === meetingId) : null;

  return (
    <Modal
      title={locked ? "Zapisnik (potrjen)" : id ? "Uredi zapisnik" : "Nov zapisnik"}
      onClose={requestClose}
      width={1000}
    >
      {loading ? (
        <div className="desc">Nalagam...</div>
      ) : locked ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <style>{`
            .rte-readonly { padding: 14px 16px; border: 1px solid rgba(107,78,46,.15); border-radius: 12px; background: rgba(255,255,255,.7); line-height: 1.55; font-size: 14px; color: #2b2013; max-height: 55vh; overflow-y: auto; }
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
              background: MINUTES_STATUS_META.potrjen.bg,
              color: MINUTES_STATUS_META.potrjen.color,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span>
              🔒 Potrjen: {meta.potrdilByName || "—"}, {tsLabel(meta.potrdilDatum)}
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
              {meta.izvirnikId ? " · popravek prejšnjega zapisnika" : ""}
            </div>
          </div>

          <div className="rte-readonly" dangerouslySetInnerHTML={{ __html: toEditorHtml(vsebina) }} />

          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Potrjenega zapisnika ni mogoče spreminjati ali brisati. Če je v njem napaka, ustvari
            popravljeno različico: nov osnutek, original pa ostane nespremenjen.
          </div>

          {err && (
            <div className="error" style={{ whiteSpace: "pre-wrap" }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={requestClose}>
              Zapri
            </button>
            <button className="btn-mini" onClick={makeCorrection} disabled={saving}>
              {saving ? "Ustvarjam…" : "Ustvari popravljeno različico"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            {["osnutek", "v_potrjevanju"].map((key) => {
              const m = MINUTES_STATUS_META[key];
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
            placeholder="Vsebina zapisnika..."
            minHeight={460}
          />

          {err && (
            <div className="error" style={{ whiteSpace: "pre-wrap" }}>
              {err}
            </div>
          )}

          {confirmApprove && (
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
                Ko zapisnik potrdiš, ga ni več mogoče spreminjati, brisati ali odkleniti. Popravek je
                možen samo kot nova različica. Nadaljujem?
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setConfirmApprove(false)}>
                  Prekliči
                </button>
                <button className="btn-mini" onClick={approve} disabled={saving}>
                  Da, potrdi zapisnik
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-ghost" onClick={requestClose}>
              Zapri
            </button>
            <button className="btn-mini" onClick={save} disabled={saving}>
              {saving ? "Shranjujem…" : id ? "Shrani spremembe" : "Ustvari zapisnik"}
            </button>
            <button
              className="btn-mini"
              onClick={() => setConfirmApprove(true)}
              disabled={saving || confirmApprove}
              style={{ background: "#1d6f42" }}
            >
              Potrdi zapisnik
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ================= ATTENDANCE ================= */

function AttendanceModal({ meeting, onClose, myCode }) {
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [savingCode, setSavingCode] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [mOut, aOut] = await Promise.all([
          api("/board/members"),
          api(`/board/meetings/${meeting.id}/attendance`),
        ]);
        if (!alive) return;
        setMembers(Array.isArray(mOut?.members) ? mOut.members : []);
        const map = {};
        for (const a of aOut?.attendance || []) {
          map[a.memberCode] = { status: a.status, updatedByCode: a.updatedByCode };
        }
        setAttendance(map);
      } catch (e) {
        if (alive) setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [meeting.id]);

  async function setStatus(memberCode, status) {
    setSavingCode(memberCode);
    setErr("");
    try {
      await api(`/board/meetings/${meeting.id}/attendance`, {
        method: "POST",
        body: { memberCode, status },
      });
      setAttendance((prev) => ({
        ...prev,
        [memberCode]: { status, updatedByCode: myCode || "" },
      }));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSavingCode(null);
    }
  }

  const presentCount = Object.values(attendance).filter((a) => a?.status === "prisoten").length;

  return (
    <Modal title={`Prisotnost — ${fmt(meeting.datum)}`} onClose={onClose}>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 14 }}>
        {members.length > 0
          ? `${presentCount} / ${members.length} prisotnih`
          : "Ni najdenih članov UO."}
      </div>

      {err && (
        <div className="error" style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {loading ? (
        <div className="desc">Nalagam...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {members.map((mmb) => {
            const currentEntry = attendance[mmb.code];
            const current = currentEntry?.status;
            const editedBy = currentEntry?.updatedByCode;
            const editedByMember = editedBy ? members.find((x) => x.code === editedBy) : null;
            const editedByLabel = editedByMember
              ? editedByMember.name
              : editedBy === mmb.code
              ? "sam"
              : editedBy || null;

            return (
              <div
                key={mmb.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "rgba(107,78,46,.05)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 800, color: "#3a2c1a", fontSize: 13 }}>{mmb.name}</span>

                <div style={{ display: "flex", gap: 6 }}>
                  {["prisoten", "opravicen", "odsoten"].map((st) => {
                    const meta = ATTENDANCE_META[st];
                    const active = current === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setStatus(mmb.code, st)}
                        disabled={savingCode === mmb.code}
                        style={{
                          border: "1px solid " + (active ? meta.color : "rgba(0,0,0,.15)"),
                          background: active ? meta.bg : "transparent",
                          color: active ? meta.color : "#666",
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                {editedByLabel && (
                  <div style={{ width: "100%", fontSize: 10, opacity: 0.5, marginTop: 2 }}>
                    uredil: {editedByLabel}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ================= SHARED UI ================= */

function Modal({ title, onClose, children, width = 520 }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useState({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })[0];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onDragStart(e) {
    dragRef.dragging = true;
    dragRef.startX = e.clientX;
    dragRef.startY = e.clientY;
    dragRef.origX = pos.x;
    dragRef.origY = pos.y;
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function onDragMove(e) {
    if (!dragRef.dragging) return;
    setPos({
      x: dragRef.origX + (e.clientX - dragRef.startX),
      y: dragRef.origY + (e.clientY - dragRef.startY),
    });
  }

  function onDragEnd() {
    dragRef.dragging = false;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fdfaf3",
          borderRadius: 16,
          padding: 24,
          width: `min(${width}px, 100%)`,
          maxHeight: "94vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(60,40,20,.35), 0 0 0 1px rgba(107,78,46,.18)",
          animation: "boardPopIn .18s ease",
          pointerEvents: "auto",
          transform: `translate(${pos.x}px, ${pos.y}px)`,
        }}
      >
        <div
          onMouseDown={onDragStart}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
            cursor: "grab",
            userSelect: "none",
          }}
        >
          <h3 style={{ margin: 0, color: "#6B4E2E", fontSize: 18 }}>{title}</h3>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Zapri"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              color: "#6B4E2E",
              opacity: 0.6,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        <div onMouseDown={(e) => e.stopPropagation()}>{children}</div>
        <style>{`
          @keyframes boardPopIn { from { opacity: 0; transform: scale(.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, display: "block", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function MiniCalendar({ month, onPrevMonth, onNextMonth, meetingsByDay, notesByDay, selectedDay, onSelectDay }) {
  const weeks = useMemo(() => buildMonthGrid(month), [month]);
  const todayKey = dayKey(new Date());

  return (
    <div
      className="stat"
      style={{ padding: 16, border: "1px solid rgba(107,78,46,.18)", background: "rgba(255,255,255,.7)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button className="btn-ghost" onClick={onPrevMonth} style={{ padding: "4px 8px" }} aria-label="Prejšnji mesec">
          ‹
        </button>
        <div style={{ fontWeight: 950, color: "#6B4E2E", fontSize: 14 }}>
          {MONTH_LABELS[month.getMonth()]} {month.getFullYear()}
        </div>
        <button className="btn-ghost" onClick={onNextMonth} style={{ padding: "4px 8px" }} aria-label="Naslednji mesec">
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {DAY_LABELS.map((d) => (
          <div key={d} style={{ fontSize: 11, fontWeight: 900, opacity: 0.5, textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {week.map((cell, di) => {
            if (!cell) return <div key={di} />;
            const key = dayKey(cell);
            const dayMeetings = meetingsByDay[key];
            const dayNotesList = notesByDay[key];
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;

            const titleParts = [];
            if (dayMeetings) titleParts.push(`${dayMeetings.length} seja/-e`);
            if (dayNotesList) titleParts.push(`${dayNotesList.length} opomba/-e`);
            if (!titleParts.length) titleParts.push("Klikni za dodajanje");

            return (
              <button
                key={di}
                onClick={() => onSelectDay(key)}
                title={titleParts.join(", ")}
                style={{
                  border: "none",
                  background: isSelected
                    ? "rgba(107,78,46,.85)"
                    : isToday
                    ? "rgba(107,78,46,.14)"
                    : "transparent",
                  color: isSelected ? "#fff" : "#2b2013",
                  borderRadius: 8,
                  height: 32,
                  fontSize: 12,
                  fontWeight: isToday || isSelected ? 900 : 600,
                  cursor: "pointer",
                  position: "relative",
                  transition: "background .15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "rgba(107,78,46,.10)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = isToday ? "rgba(107,78,46,.14)" : "transparent";
                }}
              >
                {cell.getDate()}
                {(dayMeetings || dayNotesList) && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 3,
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      gap: 3,
                    }}
                  >
                    {dayMeetings && <Dot color={isSelected ? "#fff" : "#a3372f"} />}
                    {dayNotesList && <Dot color={isSelected ? "#fff" : "#2b6fae"} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Dot({ color }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 4,
        height: 4,
        borderRadius: "50%",
        background: color,
        marginRight: 4,
      }}
    />
  );
}

function MeetingSection({ title, meetings, dim, onOpenAttendance, onOpenMinutesPicker }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.6, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {meetings.map((m) => (
          <MeetingCard
            key={m.id}
            meeting={m}
            dim={dim}
            onOpenAttendance={() => onOpenAttendance(m)}
            onOpenMinutesPicker={() => onOpenMinutesPicker(m)}
          />
        ))}
      </div>
    </div>
  );
}

function MeetingCard({ meeting, dim, onOpenAttendance, onOpenMinutesPicker }) {
  const meta = STATUS_META[meeting.status] || { label: meeting.status, color: "#555", bg: "rgba(0,0,0,.06)" };

  return (
    <div
      className="login-card"
      style={{
        padding: 16,
        border: "1px solid rgba(107,78,46,.18)",
        background: "rgba(255,255,255,.75)",
        opacity: dim ? 0.7 : 1,
        transition: "transform .15s ease, box-shadow .15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(107,78,46,.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontWeight: 950, color: "#6B4E2E", fontSize: 15 }}>
          {fmt(meeting.datum)}
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

      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
        📍 {meeting.lokacija || "brez lokacije"}
      </div>

      {meeting.dnevniRed && (
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4 }}>{meeting.dnevniRed}</div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button
          className="btn-mini"
          style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
          onClick={onOpenAttendance}
        >
          Prisotnost
        </button>
        <button
          className="btn-mini"
          style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
          onClick={onOpenMinutesPicker}
        >
          Zapisnik
        </button>
      </div>
    </div>
  );
}

function MiniStat({ title, value, desc }) {
  return (
    <div className="stat" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.6, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 950, color: "#6B4E2E", marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{desc}</div>
    </div>
  );
}

/* ================= DATE HELPERS ================= */

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(month) {
  const first = startOfMonth(month);
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI");
  } catch {
    return "—";
  }
}

function fmtShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("sl-SI", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

function fmtDayLabel(key) {
  try {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("sl-SI", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return key;
  }
}