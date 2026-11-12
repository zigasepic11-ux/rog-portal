// src/ResetPinPage.jsx
import { useState } from "react";
import { confirmPinReset } from "./firebase.js";

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get("token") || "",
    uid: params.get("uid") || "",
  };
}

export default function ResetPinPage() {
  const { token, uid } = getQueryParams();

  const [pin, setPin] = useState("");
  const [pinRepeat, setPinRepeat] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const missingParams = !token || !uid;

  async function submit(e) {
    e.preventDefault();
    setErr("");

    if (missingParams) {
      setErr("Povezava ni veljavna - manjkajo podatki.");
      return;
    }
    if (pin.length < 6) {
      setErr("PIN mora imeti vsaj 6 znakov.");
      return;
    }
    if (pin !== pinRepeat) {
      setErr("PIN se ne ujema s ponovljenim PIN-om.");
      return;
    }

    setLoading(true);
    try {
      await confirmPinReset({ uid, token, newPin: pin });
      setSuccess(true);
    } catch (e) {
      const code = e?.code || "";
      if (code.includes("deadline-exceeded")) {
        setErr("Povezava je potekla. Ponovno zahtevajte ponastavitev PIN-a.");
      } else if (code.includes("permission-denied")) {
        setErr("Povezava ni veljavna ali je že bila uporabljena.");
      } else {
        setErr(e?.message || "Napaka pri ponastavitvi PIN-a.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <>
        <div className="topbar">
          <span className="tree">🌲</span>
          <span>ROG</span>
        </div>
        <div className="page">
          <div className="login-card">
            <div className="login-title">PIN uspešno ponastavljen</div>
            <p>
              Vaš nov PIN je nastavljen. Vse ostale naprave, kjer ste bili
              prijavljeni, so bile samodejno odjavljene zaradi varnosti.
            </p>
            <a
              className="btn"
              href="/"
              style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}
            >
              Pojdi na prijavo
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <span className="tree">🌲</span>
        <span>ROG</span>
      </div>

      <div className="page">
        <div className="login-card">
          <div className="login-title">Nastavi nov PIN</div>

          {missingParams ? (
            <div className="error">
              Povezava ni veljavna. Preverite, da ste kliknili celotno
              povezavo iz emaila, ali ponovno zahtevajte ponastavitev.
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="field">
                <div className="label">Nov PIN (najmanj 6 znakov, črke in številke)</div>
                <input
                  className="input"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="npr. moj1PIN"
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <div className="field">
                <div className="label">Ponovi PIN</div>
                <input
                  className="input"
                  value={pinRepeat}
                  onChange={(e) => setPinRepeat(e.target.value)}
                  placeholder="ponovite PIN"
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <button className="btn" disabled={loading}>
                {loading ? "Nastavljam..." : "Nastavi nov PIN"}
              </button>

              {err && <div className="error">{err}</div>}
            </form>
          )}
        </div>
      </div>
    </>
  );
}