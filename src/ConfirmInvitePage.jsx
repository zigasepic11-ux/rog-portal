// src/ConfirmInvitePage.jsx
import { useState } from "react";
import { confirmInvite } from "./firebase.js";
import TermsPage from "./TermsPage.jsx";
import PrivacyPage from "./PrivacyPage.jsx";

// TODO: uskladi s končno verzijo ToU, ko jo odvetnik potrdi (glej TODO Faza 0)
const TERMS_VERSION = "v1-osnutek";

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get("token") || "",
    membershipId: params.get("membership") || "",
  };
}

export default function ConfirmInvitePage() {
  const { token, membershipId } = getQueryParams();

  const [pin, setPin] = useState("");
  const [pinRepeat, setPinRepeat] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const missingParams = !token || !membershipId;

  async function submit(e) {
    e.preventDefault();
    setErr("");

    if (missingParams) {
      setErr("Povezava ni veljavna - manjkajo podatki. Preverite, da ste kliknili celotno povezavo iz emaila.");
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
    if (!termsAccepted) {
      setErr("Za nadaljevanje morate potrditi pogoje uporabe in politiko zasebnosti.");
      return;
    }

    setLoading(true);
    try {
      await confirmInvite({
        membershipId,
        token,
        pin,
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
      });
      setSuccess(true);
    } catch (e) {
      const code = e?.code || "";
      if (code.includes("already-exists")) {
        setErr("To povabilo je že bilo potrjeno. Poskusite se prijaviti z novim PIN-om.");
      } else if (code.includes("deadline-exceeded")) {
        setErr("Povezava je potekla. Prosite moderatorja za novo povabilo.");
      } else if (code.includes("permission-denied")) {
        setErr("Povezava ni veljavna.");
      } else {
        setErr(e?.message || "Napaka pri potrditvi povabila.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (showTerms) {
    return (
      <div className="page">
        <div className="login-card">
          <TermsPage />
          <button className="btn" onClick={() => setShowTerms(false)}>
            Nazaj
          </button>
        </div>
      </div>
    );
  }

  if (showPrivacy) {
    return (
      <div className="page">
        <div className="login-card">
          <PrivacyPage />
          <button className="btn" onClick={() => setShowPrivacy(false)}>
            Nazaj
          </button>
        </div>
      </div>
    );
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
            <div className="login-title">Dobrodošli v ROG Sistem!</div>
            <p>Vaš PIN je uspešno nastavljen. Sedaj se lahko prijavite z vašim emailom in novim PIN-om.</p>
            <a className="btn" href="/" style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}>
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
          <div className="login-title">Nastavi PIN</div>

          {missingParams ? (
            <div className="error">
              Povezava ni veljavna. Preverite, da ste kliknili celotno povezavo iz emaila, ali prosite moderatorja za novo povabilo.
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

              <div className="field" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <div>
                  Strinjam se s{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>
                    pogoji uporabe
                  </a>{" "}
                  in{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}>
                    politiko zasebnosti
                  </a>
                  .
                </div>
              </div>

              <button className="btn" disabled={loading}>
                {loading ? "Nastavljam..." : "Aktiviraj račun"}
              </button>

              {err && <div className="error">{err}</div>}
            </form>
          )}
        </div>
      </div>
    </>
  );
}