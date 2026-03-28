// src/Portal.jsx
import { useEffect, useMemo, useState } from "react";
import { api, clearToken, setToken } from "./api.js";

import UsersPage from "./UsersPage.jsx";
import HuntLogsPage from "./HuntLogsPage.jsx";
import ActiveHuntsPage from "./ActiveHuntsPage.jsx";
import KmlMejePage from "./KmlMejePage.jsx";
import OdvzemPage from "./OdvzemPage.jsx";
import EventsPage from "./EventsPage.jsx";
import WorkHoursPage from "./WorkHoursPage.jsx";
import Footer from "./components/Footer.jsx";
import TermsPage from "./TermsPage.jsx";
import PrivacyPage from "./PrivacyPage.jsx";
import DocumentsPage from "./DocumentsPage.jsx";

const NAV = [
  { key: "home", label: "Domov" },
  { key: "events", label: "Dogodki" },
  { key: "workhours", label: "Delovne ure" },
  { key: "active", label: "Aktivni lov" },
  { key: "users", label: "Uporabniki" },
  { key: "logs", label: "Dnevniki lova" },
  { key: "odvzem", label: "Plan odvzema" },
  { key: "kml", label: "KML / meje" },
  { key: "docs", label: "Dokumenti" },
];

function isMobileNow() {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
}

export default function Portal({ onLogout }) {
  const [dash, setDash] = useState(null);
  const [me, setMe] = useState(null);
  const [lds, setLds] = useState([]);

  const [err, setErr] = useState("");
  const [tab, setTab] = useState("home");
  const [busyLd, setBusyLd] = useState(false);

  const [isMobile, setIsMobile] = useState(() => isMobileNow());
  const [menuOpen, setMenuOpen] = useState(false);

  const isSuper = useMemo(() => {
    const r = String(me?.role || "").trim();
    return r === "super" || r === "admin";
  }, [me?.role]);

  const activeLdId = useMemo(
    () => String(dash?.ldId || me?.ldId || "").trim(),
    [dash?.ldId, me?.ldId]
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = () => {
      const m = mq.matches;
      setIsMobile(m);
      if (!m) setMenuOpen(false);
    };

    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    api("/auth/me")
      .then((x) => setMe(x.user || null))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    setErr("");
    api("/ld/dashboard")
      .then((x) => setDash(x || null))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!isSuper) {
      setLds([]);
      return;
    }

    api("/auth/lds")
      .then((out) => setLds(Array.isArray(out.lds) ? out.lds : []))
      .catch(() => setLds([]));
  }, [isSuper]);

  function logout() {
    clearToken();
    onLogout?.();
  }

  async function switchLd(ldId) {
    const target = String(ldId || "").trim();
    if (!target || busyLd) return;

    setBusyLd(true);
    setErr("");

    try {
      const out = await api("/auth/switch-ld", {
        method: "POST",
        body: { ldId: target },
      });

      setToken(out.token);
      window.location.reload();
    } catch (e) {
      setErr(e.message);
      setBusyLd(false);
    }
  }

  function goTab(t) {
    setTab(t);
    if (isMobile) setMenuOpen(false);
  }

  return (
    <div className="portal-layout">
      <div className="portal-main">
        <div className="app">
          <div className="appbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isMobile && (
                <button
                  className="btn-ghost"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Odpri meni"
                  title="Meni"
                  style={{ padding: "8px 10px" }}
                >
                  ☰
                </button>
              )}

              <div>
                <div className="brand-left">
                  <span className="tree">🌲</span>
                  <span>ROG</span>

                  {isSuper && (
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 12,
                        fontWeight: 900,
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(107,78,46,.35)",
                        background: "rgba(255,255,255,.6)",
                        color: "#6B4E2E",
                      }}
                    >
                      ADMIN
                    </span>
                  )}
                </div>

                <div className="brand-sub">
                  {dash?.ldName
                    ? `LD: ${dash.ldName} (${dash.ldId})`
                    : activeLdId
                    ? `LD: ${activeLdId}`
                    : "Nalagam..."}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {isSuper && (
                <select
                  className="input"
                  style={{
                    height: 42,
                    width: isMobile ? "min(320px, 70vw)" : 260,
                    fontSize: 14,
                  }}
                  value={activeLdId || ""}
                  onChange={(e) => switchLd(e.target.value)}
                  title="Preklop LD (admin)"
                  disabled={busyLd}
                >
                  <option value="" disabled>
                    {lds.length ? "Izberi LD…" : "Nalagam LD…"}
                  </option>

                  {lds.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              )}

              <button className="btn-mini" onClick={logout}>
                Odjava
              </button>
            </div>
          </div>

          {isMobile && menuOpen && (
            <div
              className="drawer-backdrop"
              onMouseDown={() => setMenuOpen(false)}
              role="presentation"
            >
              <div
                className="drawer"
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Meni"
              >
                <div className="drawer-head">
                  <div className="drawer-title">Meni</div>
                  <button
                    className="btn-ghost"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Zapri meni"
                  >
                    ✕
                  </button>
                </div>

                <div className="drawer-body">
                  {NAV.map((n) => (
                    <button
                      key={n.key}
                      className={"navbtn" + (tab === n.key ? " active" : "")}
                      onClick={() => goTab(n.key)}
                    >
                      <span>{n.label}</span>
                      <span style={{ opacity: 0.5 }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="shell">
            {!isMobile && (
              <aside className="sidebar">
                <div className="nav-title">Meni</div>

                {NAV.map((n) => (
                  <button
                    key={n.key}
                    className={"navbtn" + (tab === n.key ? " active" : "")}
                    onClick={() => goTab(n.key)}
                  >
                    <span>{n.label}</span>
                    <span style={{ opacity: 0.5 }}>›</span>
                  </button>
                ))}
              </aside>
            )}

            <main className="content">
              <h2 className="page-title">{titleFor(tab)}</h2>
              <p className="page-sub">{subtitleFor(tab)}</p>

              {err && <div className="error">{err}</div>}

              {tab === "home" && <HomePage dash={dash} onGo={goTab} me={me} />}
              {tab === "events" && (
                <EventsPage me={me} onBackHome={() => goTab("home")} />
              )}
              {tab === "workhours" && <WorkHoursPage />}
              {tab === "active" && <ActiveHuntsPage />}
              {tab === "users" && <UsersPage />}
              {tab === "logs" && <HuntLogsPage />}
              {tab === "odvzem" && <OdvzemPage me={me} />}
              {tab === "kml" && <KmlMejePage dash={dash} me={me} />}
              {tab === "terms" && <TermsPage />}
              {tab === "privacy" && <PrivacyPage />}

              {tab === "docs" && <DocumentsPage me={me} onBackHome={() => goTab("home")} />}
            </main>
          </div>
        </div>
      </div>

      <Footer onNavigate={goTab} />
    </div>
  );
}

function HomePage({ dash, onGo, me }) {
  return (
    <>
      <div className="grid">
        <Stat
          title="Uporabniki"
          value={dash?.usersCount ?? "—"}
          desc="Število članov v sistemu"
        />
        <Stat
          title="Dnevniki"
          value={dash?.huntsThisMonth ?? "—"}
          desc="Vnosi v tem mesecu"
        />
        <Stat
          title="LD ID"
          value={dash?.ldId ?? "—"}
          desc="Identifikator lovske družine"
        />
        <Stat
          title="Zadnja sinhronizacija"
          value={fmt(dash?.lastSync)}
          desc="Stanje sistema"
        />
      </div>

      <div style={{ marginTop: 16 }} className="stat">
        <h4>Hitre akcije</h4>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Quick label="Dogodki" onClick={() => onGo("events")} />
          <Quick label="Delovne ure" onClick={() => onGo("workhours")} />
          <Quick label="Aktivni lov" onClick={() => onGo("active")} />
          <Quick label="Uporabniki" onClick={() => onGo("users")} />
          <Quick label="Dnevniki lova" onClick={() => onGo("logs")} />
          <Quick label="Plan odvzema" onClick={() => onGo("odvzem")} />
          <Quick label="KML / meje" onClick={() => onGo("kml")} />
          <Quick label="Dokumenti" onClick={() => onGo("docs")} />
        </div>
      </div>

      <div style={{ marginTop: 16 }} className="stat">
        <EventsPreview me={me} onGo={() => onGo("events")} />
      </div>
    </>
  );
}

function EventsPreview({ me, onGo }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const out = await api(`/ld/events?future=1&limit=3`);
        if (!alive) return;
        setEvents(Array.isArray(out?.events) ? out.events : []);
      } catch (e) {
        if (!alive) return;
        setEvents([]);
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [me?.ldId]);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h4 style={{ marginBottom: 4 }}>Dogodki</h4>
          <div className="desc">
            Naslednji dogodki v LD (občni zbor, strelske tekme, sestanki...).
          </div>
        </div>

        <button className="btn-mini" onClick={onGo}>
          Poglej vse
        </button>
      </div>

      {err && (
        <div className="error" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {loading ? (
          <div className="desc">Nalagam...</div>
        ) : events.length === 0 ? (
          <div className="desc">Ni dogodkov.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {events.map((e) => (
              <div
                key={e.id}
                className="login-card"
                style={{
                  padding: 14,
                  border: "1px solid rgba(107,78,46,.18)",
                  background: "rgba(255,255,255,.70)",
                }}
              >
                <div style={{ fontWeight: 950, color: "#6B4E2E" }}>
                  {e.title || "—"}
                </div>
                <div style={{ marginTop: 6, fontWeight: 900 }}>
                  {fmt(e.startsAt)}
                </div>
                <div style={{ marginTop: 4, opacity: 0.75 }}>
                  {e.location || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ title, value, desc }) {
  return (
    <div className="stat">
      <h4>{title}</h4>
      <div className="big">{value}</div>
      <div className="desc">{desc}</div>
    </div>
  );
}

function Quick({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "1px solid rgba(107,78,46,.35)",
        background: "rgba(255,255,255,.70)",
        borderRadius: 12,
        padding: "10px 12px",
        fontWeight: 900,
        color: "#6B4E2E",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI");
  } catch {
    return "—";
  }
}

function titleFor(tab) {
  switch (tab) {
    case "events":
      return "Dogodki";
    case "workhours":
      return "Delovne ure";
    case "active":
      return "Aktivni lov";
    case "users":
      return "Uporabniki";
    case "logs":
      return "Dnevniki lova";
    case "odvzem":
      return "Plan odvzema";
    case "kml":
      return "KML / meje lovišča";
    case "docs":
      return "Dokumenti";
    case "terms":
      return "Pogoji uporabe";
    case "privacy":
      return "Zasebnost";
    default:
      return "Domov";
  }
}

function subtitleFor(tab) {
  switch (tab) {
    case "events":
      return "Dogodki in obvestila lovske družine.";
    case "workhours":
      return "Pregled planiranih in opravljenih delovnih ur članov.";
    case "active":
      return "Kdo je trenutno na lovu (z lokacijo, če je na voljo).";
    case "users":
      return "Upravljanje članov, PIN-ov in vlog.";
    case "logs":
      return "Pregled, filtriranje in izvoz dnevnikov.";
    case "odvzem":
      return "Plan (načrt) in realizacija iz dnevnikov – avtomatsko.";
    case "kml":
      return "Uvoz KML in status lovišča.";
    case "docs":
      return "Obrazci, priloge in dokumentacija.";
    case "terms":
      return "Pravila in pogoji uporabe sistema ROG.";
    case "privacy":
      return "Informacije o varstvu podatkov in zasebnosti uporabnikov.";
    default:
      return "Pregled stanja in hitre akcije.";
  }
}