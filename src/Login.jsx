// src/Login.jsx
import { useState } from "react";
import { api, setToken } from "./api.js";
import { loginWithEmailPin, bridgeLegacyLogin } from "./firebase.js";

function OldLoginForm({ onLoggedIn, onSwitchMode }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const out = await api("/auth/login", {
        method: "POST",
        body: { code: code.trim(), pin: pin.trim() },
      });

      if (!out?.token) {
        throw new Error("Login ni vrnil tokena.");
      }

      localStorage.setItem("token", out.token);

      // Vzpostavi tudi vzporedno Firebase Auth sejo (za dostop do novih
      // Cloud Functions kot je inviteMember) - ne blokira prijave, če spodleti.
      if (out.firebaseToken) {
        try {
          await bridgeLegacyLogin(out.firebaseToken);
        } catch (bridgeErr) {
          console.warn("Firebase bridge prijava ni uspela:", bridgeErr);
        }
      }

      if (typeof onLoggedIn === "function") {
        onLoggedIn(out.user || null);
      }
    } catch (e) {
      setErr(e?.message || "Napaka pri prijavi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <div className="label">ID</div>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="npr. 999999"
          autoComplete="username"
        />
      </div>

      <div className="field">
        <div className="label">PIN</div>
        <input
          className="input"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          type="password"
          autoComplete="current-password"
        />
      </div>

      <button className="btn" disabled={loading}>
        {loading ? "Prijavljam..." : "Prijava"}
      </button>

      {err && <div className="error">{err}</div>}

      <a
        href="/pozabljen-pin"
        style={{ display: "block", marginTop: 12, textAlign: "center" }}
      >
        Pozabljen PIN?
      </a>

      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onSwitchMode(); }}
        style={{ display: "block", marginTop: 8, textAlign: "center", fontSize: 13 }}
      >
        Imate email račun? Prijavite se tukaj
      </a>
    </form>
  );
}

function NewLoginForm({ onLoggedIn, onSwitchMode }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [ldOptions, setLdOptions] = useState(null);

  async function completeLogin(idToken, ldId) {
    const out = await api("/auth/login-firebase", {
      method: "POST",
      body: ldId ? { idToken, ldId } : { idToken },
    });

    if (out?.needsLdSelection) {
      setLdOptions(out.lds);
      return;
    }
    if (!out?.token) {
      throw new Error("Prijava ni vrnila tokena.");
    }

    setToken(out.token);
    if (typeof onLoggedIn === "function") {
      onLoggedIn(out.user || null);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const idToken = await loginWithEmailPin(email.trim(), pin.trim());
      window.__lastIdToken = idToken; // za izbiro LD spodaj, če je potrebna
      await completeLogin(idToken);
    } catch (e) {
      const code = e?.code || "";
      if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
        setErr("Napačen email ali PIN.");
      } else {
        setErr(e?.message || "Napaka pri prijavi.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function selectLd(ldId) {
    setErr("");
    setLoading(true);
    try {
      await completeLogin(window.__lastIdToken, ldId);
    } catch (e) {
      setErr(e?.message || "Napaka pri izbiri lovske družine.");
    } finally {
      setLoading(false);
    }
  }

  if (ldOptions) {
    return (
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          Član ste več lovskih družin - izberite:
        </div>
        {ldOptions.map((o) => (
          <button
            key={o.ldId}
            className="btn"
            style={{ marginBottom: 8 }}
            disabled={loading}
            onClick={() => selectLd(o.ldId)}
          >
            {o.ldId} ({o.role})
          </button>
        ))}
        {err && <div className="error">{err}</div>}
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <div className="label">Email</div>
        <input
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vas@email.si"
          type="email"
          autoComplete="username"
        />
      </div>

      <div className="field">
        <div className="label">PIN</div>
        <input
          className="input"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          type="password"
          autoComplete="current-password"
        />
      </div>

      <button className="btn" disabled={loading}>
        {loading ? "Prijavljam..." : "Prijava"}
      </button>

      {err && <div className="error">{err}</div>}

      <a
        href="/pozabljen-pin"
        style={{ display: "block", marginTop: 12, textAlign: "center" }}
      >
        Pozabljen PIN?
      </a>

      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onSwitchMode(); }}
        style={{ display: "block", marginTop: 8, textAlign: "center", fontSize: 13 }}
      >
        Nazaj na staro prijavo (ID + PIN)
      </a>
    </form>
  );
}

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState("new"); // "old" | "new" (privzeto: email + PIN)

  return (
    <>
      <div className="topbar">
        <span className="tree">🌲</span>
        <span>ROG</span>
      </div>

      <div className="page">
        <div className="login-card">
          <div className="login-title">Prijava</div>

          {mode === "old" ? (
            <OldLoginForm onLoggedIn={onLoggedIn} onSwitchMode={() => setMode("new")} />
          ) : (
            <NewLoginForm onLoggedIn={onLoggedIn} onSwitchMode={() => setMode("old")} />
          )}
        </div>
      </div>
    </>
  );
}