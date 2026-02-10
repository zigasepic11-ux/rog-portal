// src/Portal.jsx
import { useEffect, useMemo, useState } from "react";
import { api, clearToken, setToken } from "./api.js";

import UsersPage from "./UsersPage.jsx";
import HuntLogsPage from "./HuntLogsPage.jsx";
import ActiveHuntsPage from "./ActiveHuntsPage.jsx";
import KmlMejePage from "./KmlMejePage.jsx";
import OdvzemPage from "./OdvzemPage.jsx"; // ✅ NOVO

const NAV = [
  { key: "home", label: "Domov" },
  { key: "active", label: "Aktivni lov" },
  { key: "users", label: "Uporabniki" },
  { key: "logs", label: "Dnevniki lova" },
  { key: "odvzem", label: "Plan odvzema" }, // ✅ NOVO
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

  // ✅ Mobile menu (drawer)
  const [isMobile, setIsMobile] = useState(() => isMobileNow());
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ super samo po role
  const isSuper = useMemo(() => String(me?.role || "") === "super", [me?.role]);

  // ✅ active LD: primarno dashboard
  const activeLdId = useMemo(() => {
    return String(dash?.ldId || me?.ldId || "").trim();
  }, [dash?.ldId, me?.ldId]);

  // watch viewport changes (mobile/desktop)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = () => {
      const m = mq.matches;
      setIsMobile(m);
      if (!m) setMenuOpen(false); // ko gre na desktop, zapri drawer
    };

    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // ESC to close menu
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // 1) load /auth/me
  useEffect(() => {
    api("/auth/me")
      .then((x) => setMe(x.user || null))
      .catch(() => setMe(null));
  }, []);

  // 2) load dashboard
  useEffect(() => {
    setErr("");
    api("/ld/dashboard")
      .then((x) => setDash(x || null))
      .catch((e) => setErr(e.message));
  }, []);

  // 3) super -> load lds (ko me pride)
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
    <div className="app">
      {/* TOP BAR */}
      <div className="appbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* ✅ Mobile hamburger */}
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* ✅ Dropdown se pokaže samo za super */}
          {isSuper && (
            <select
              className="input"
              style={{ height: 42, width: isMobile ? "min(320px, 70vw)" : 260, fontSize: 14 }}
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

      {/* ✅ Mobile drawer overlay */}
      {isMobile && menuOpen && (
        <div className="drawer-backdrop" onMouseDown={() => setMenuOpen(false)} role="presentation">
          <div className="drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Meni">
            <div className="drawer-head">
              <div className="drawer-title">Meni</div>
              <button className="btn-ghost" onClick={() => setMenuOpen(false)} aria-label="Zapri meni">
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

      {/* LAYOUT */}
      <div className="shell">
        {/* SIDEBAR (desktop only) */}
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

        {/* CONTENT */}
        <main className="content">
          <h2 className="page-title">{titleFor(tab)}</h2>
          <p className="page-sub">{subtitleFor(tab)}</p>

          {err && <div className="error">{err}</div>}

          {tab === "home" && <HomePage dash={dash} onGo={goTab} />}
          {tab === "active" && <ActiveHuntsPage />}
          {tab === "users" && <UsersPage />}
          {tab === "logs" && <HuntLogsPage />}
          {tab === "odvzem" && <OdvzemPage me={me} />}
          {tab === "kml" && <KmlMejePage dash={dash} />}

          {tab === "docs" && (
            <div className="stat">
              <h4>V razvoju</h4>
              <div className="desc">Ta modul je MVP placeholder.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function HomePage({ dash, onGo }) {
  return (
    <>
      <div className="grid">
        <Stat title="Uporabniki" value={dash?.usersCount ?? "—"} desc="Število članov v sistemu" />
        <Stat title="Dnevniki" value={dash?.huntsThisMonth ?? "—"} desc="Vnosi v tem mesecu" />
        <Stat title="LD ID" value={dash?.ldId ?? "—"} desc="Identifikator lovske družine" />
        <Stat title="Zadnja sinhronizacija" value={fmt(dash?.lastSync)} desc="Stanje sistema" />
      </div>

      <div style={{ marginTop: 16 }} className="stat">
        <h4>Hitre akcije</h4>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Quick label="Aktivni lov" onClick={() => onGo("active")} />
          <Quick label="Uporabniki" onClick={() => onGo("users")} />
          <Quick label="Dnevniki lova" onClick={() => onGo("logs")} />
          <Quick label="Plan odvzema" onClick={() => onGo("odvzem")} />
          <Quick label="KML / meje" onClick={() => onGo("kml")} />
          <Quick label="Dokumenti" onClick={() => onGo("docs")} />
        </div>
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
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function titleFor(tab) {
  switch (tab) {
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
    default:
      return "Domov";
  }
}

function subtitleFor(tab) {
  switch (tab) {
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
    default:
      return "Pregled stanja in hitre akcije.";
  }
}
