// src/Login.jsx
import { useState } from "react";
import { api, setToken } from "./api.js";

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
        body: { code: code.trim(), pin: pin.trim() },
      });

      setToken(out.token);
      onLoggedIn?.(out.user);
    } catch (e) {
      setErr(e.message);
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
