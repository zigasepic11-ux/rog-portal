// src/Login.jsx
import { useState } from "react";
import { api } from "./api.js";

export default function Login({ onLoggedIn }) {
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
        body: {
          code: code.trim(),
          pin: pin.trim(),
        },
      });

      if (!out?.token) {
        throw new Error("Login ni vrnil tokena.");
      }

      // ✅ shrani token
      localStorage.setItem("token", out.token);

      // ✅ obvesti app
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
    <>
      <div className="topbar">
        <span className="tree">🌲</span>
        <span>ROG</span>
      </div>

      <div className="page">
        <div className="login-card">
          <div className="login-title">Prijava</div>

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
          </form>
        </div>
      </div>
    </>
  );
}
