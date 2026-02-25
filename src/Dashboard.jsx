// src/Dashboard.jsx
import { useEffect, useState } from "react";
import { api } from "./api.js";

/* ===== helpers ===== */
function fmtDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit" });
}
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
}
function typeLabel(t) {
  const s = String(t || "");
  if (s === "obcni_zbor") return "Občni zbor";
  if (s === "meeting") return "Sestanek";
  if (s === "competition") return "Strelska tekma";
  return "Dogodek";
}

function HomeEvents({ onOpenAll }) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const todayIso = new Date().toISOString();
        const out = await api(`/ld/events?from=${encodeURIComponent(todayIso)}&limit=3`);
        setEvents(Array.isArray(out?.events) ? out.events : []);
      } catch (e) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div
      className="login-card"
      style={{
        padding: 0,
        borderRadius: 18,
        border: "1px solid rgba(107,78,46,.18)",
        boxShadow: "0 12px 30px rgba(0,0,0,.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "linear-gradient(180deg, rgba(239,230,214,.85), rgba(255,255,255,1))",
          borderBottom: "1px solid rgba(107,78,46,.12)",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, color: "#6B4E2E" }}>Dogodki</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Naslednji dogodki v LD</div>
        </div>

        <button
          className="btn-mini"
          onClick={onOpenAll}
          style={{
            borderRadius: 999,
            padding: "10px 14px",
            border: "1px solid rgba(107,78,46,.22)",
            background: "rgba(107,78,46,.08)",
            color: "#6B4E2E",
            fontWeight: 900,
          }}
        >
          Poglej vse
        </button>
      </div>

      <div style={{ padding: 14 }}>
        {err && (
          <div className="error" style={{ marginBottom: 10, whiteSpace: "pre-wrap" }}>
            {err}
          </div>
        )}

        {loading && <div style={{ opacity: 0.7 }}>Nalagam dogodke…</div>}

        {!loading && !err && events.length === 0 && <div style={{ opacity: 0.7 }}>Ni načrtovanih dogodkov.</div>}

        {!loading && events.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {events.map((ev) => {
              const start = ev.startsAt;
              const end = ev.endsAt;

              return (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(107,78,46,.14)",
                    background: "rgba(250,245,236,.55)",
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 56,
                      borderRadius: 14,
                      background: "white",
                      border: "1px solid rgba(107,78,46,.14)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontWeight: 950, color: "#6B4E2E", lineHeight: 1.05 }}>
                      {fmtDateShort(start)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {fmtTime(start)}
                      {end ? `–${fmtTime(end)}` : ""}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 950, color: "rgba(43,43,43,.92)" }}>{ev.title || "Dogodek"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{ev.location ? ev.location : "—"}</div>
                  </div>

                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(107,78,46,.18)",
                      background: "rgba(107,78,46,.06)",
                      color: "#6B4E2E",
                      fontWeight: 900,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                    title={ev.type || ""}
                  >
                    {typeLabel(ev.type)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== page ===== */

export default function Dashboard({ user, onLogout, onGoEvents }) {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/ld/dashboard")
      .then((d) => setStats(d))
      .catch(() => {
        setStats({
          ldName: user?.ldName || "Lovska družina",
          usersCount: 0,
          huntsThisMonth: 0,
          lastSync: "—",
        });
      });
  }, [user]);

  return (
    <>
      <div className="topbar">
        <span className="tree">🌲</span>
        <span>ROG</span>
      </div>

      <div className="page">
        <div style={{ width: "min(900px, 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h2 style={{ margin: "0 0 6px", color: "#6B4E2E" }}>Domov</h2>
              <div style={{ color: "rgba(43,43,43,.70)" }}>{stats?.ldName || "Nalagam..."}</div>
            </div>

            <button className="btn" style={{ width: "auto", padding: "10px 14px", height: "44px" }} onClick={onLogout}>
              Odjava
            </button>
          </div>

          {err && <div className="error">{err}</div>}

          {/* kartice */}
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <Card title="Uporabniki" value={`${stats?.usersCount ?? "—"}`} desc="Število članov v sistemu" />
            <Card title="Dnevniki" value={`${stats?.huntsThisMonth ?? "—"}`} desc="Vnosi v tem mesecu" />
            <Card title="KML / Meje" value="—" desc="Uvoz/posodobitev lovišča" />
            <Card title="Dokumenti" value="—" desc="Obrazci in priponke" />
          </div>

          {/* ✅ TUKAJ zapolnimo “velik prazen prostor” */}
          <div style={{ marginTop: 18 }}>
            <HomeEvents onOpenAll={() => (onGoEvents ? onGoEvents() : alert("Odpri stran Dogodki (Portal.jsx)"))} />
          </div>

          {/* hitre akcije */}
          <div style={{ marginTop: 18 }} className="login-card">
            <div className="login-title" style={{ marginBottom: 8 }}>
              Hitre akcije
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              <SmallBtn label="Dodaj uporabnika" onClick={() => alert("MVP: naslednji korak")} />
              <SmallBtn label="Naloži KML" onClick={() => alert("MVP: naslednji korak")} />
              <SmallBtn label="Preglej dnevnike" onClick={() => alert("MVP: naslednji korak")} />
              <SmallBtn label="Nastavitve LD" onClick={() => alert("MVP: naslednji korak")} />
            </div>

            <div className="helper" style={{ marginTop: 12 }}>
              (Zaenkrat je to MVP. Potem dodamo prave strani + API.)
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ title, value, desc }) {
  return (
    <div className="login-card" style={{ padding: 16 }}>
      <div style={{ color: "#6B4E2E", fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
      <div style={{ color: "rgba(43,43,43,.65)", marginTop: 4 }}>{desc}</div>
    </div>
  );
}

function SmallBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "2px solid rgba(107,78,46,.75)",
        background: "rgba(255,255,255,.65)",
        borderRadius: 12,
        padding: "10px 12px",
        fontWeight: 800,
        color: "#6B4E2E",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
