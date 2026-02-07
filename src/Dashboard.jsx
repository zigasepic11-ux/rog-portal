import { useEffect, useState } from "react";
import { api } from "./api.js";

export default function Dashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    // MVP: ker /ld/dashboard še nimaš, naredimo fallback.
    // Če endpoint obstaja, bo prikazal prave podatke.
    api("/ld/dashboard")
      .then((d) => setStats(d))
      .catch(() => {
        // fallback mock, da UI ne “razpade”
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
              <div style={{ color: "rgba(43,43,43,.70)" }}>
                {stats?.ldName || "Nalagam..."}
              </div>
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

          {/* hitre akcije */}
          <div style={{ marginTop: 18 }} className="login-card">
            <div className="login-title" style={{ marginBottom: 8 }}>Hitre akcije</div>

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
