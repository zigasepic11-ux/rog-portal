// src/RequestPinResetPage.jsx
import { useState } from "react";
import { requestPinReset } from "./firebase.js";

export default function RequestPinResetPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");

    if (!email.trim()) {
      setErr("Email je obvezen.");
      return;
    }

    setLoading(true);
    try {
      await requestPinReset({ email: email.trim() });
      // Vedno prikažemo "poslano" sporočilo, ne glede na to, ali email
      // dejansko obstaja - to preprečuje ugibanje registriranih naslovov.
      setSent(true);
    } catch (e) {
      setErr(e?.message || "Napaka pri pošiljanju zahteve.");
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
          <div className="login-title">Pozabljen PIN</div>

          {sent ? (
            <p>
              Če je vnešeni email povezan z računom, boste kmalu prejeli
              povezavo za nastavitev novega PIN-a. Preverite tudi mapo z
              vsiljeno pošto.
            </p>
          ) : (
            <form onSubmit={submit}>
              <div className="field">
                <div className="label">Email</div>
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vas@email.si"
                  type="email"
                  autoComplete="email"
                />
              </div>

              <button className="btn" disabled={loading}>
                {loading ? "Pošiljam..." : "Pošlji povezavo za ponastavitev"}
              </button>

              {err && <div className="error">{err}</div>}
            </form>
          )}

          <a href="/" style={{ display: "block", marginTop: 12, textAlign: "center" }}>
            Nazaj na prijavo
          </a>
        </div>
      </div>
    </>
  );
}