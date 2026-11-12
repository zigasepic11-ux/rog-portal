// src/MigrationPage.jsx
import { useEffect, useState } from "react";
import { api } from "./api.js";
import { bulkInviteLegacyMembers } from "./firebase.js";

function parsePairs(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, email] = line.split(",").map((s) => (s || "").trim());
      return { code, email };
    })
    .filter((p) => p.code && p.email);
}

export default function MigrationPage() {
  const [currentLdId, setCurrentLdId] = useState("");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState(null);

  useEffect(() => {
    api("/auth/me")
      .then((out) => setCurrentLdId(out?.user?.ldId || ""))
      .catch(() => {});
  }, []);

  const pairs = parsePairs(raw);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setResults(null);

    if (pairs.length === 0) {
      setErr("Vnesite vsaj en par 'koda, email' (vsak v svoji vrstici).");
      return;
    }
    if (!currentLdId) {
      setErr("Ni bilo mogoče ugotoviti vaše lovske družine. Poskusite se znova prijaviti.");
      return;
    }

    setLoading(true);
    try {
      const out = await bulkInviteLegacyMembers({ ldId: currentLdId, pairs });
      setResults(out.data.results || []);
    } catch (e) {
      setErr(e?.message || "Napaka pri pošiljanju povabil.");
    } finally {
      setLoading(false);
    }
  }

  const sentCount = results ? results.filter((r) => r.status === "sent").length : 0;
  const errorCount = results ? results.filter((r) => r.status === "error").length : 0;

  return (
    <>
      <div className="page-sub" style={{ marginBottom: 10 }}>
        Migracija obstoječih članov (star ID+PIN sistem) na nov email+PIN sistem.
        Za vsakega člana potrebujete njegovo trenutno KODO (kot v starem sistemu) in
        NJEGOV EMAIL naslov (zbran ločeno, npr. na sestanku ali preko obrazca).
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <div className="label">Seznam (koda, email) - vsak par v svoji vrstici</div>
          <textarea
            className="input"
            style={{ height: 200, paddingTop: 12, fontFamily: "monospace", fontSize: 13 }}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"1001, janez.novak@email.si\n1002, ana.kovac@email.si"}
          />
        </div>

        <div className="page-sub" style={{ marginTop: -6 }}>
          Zaznanih parov: {pairs.length} (največ 200 naenkrat)
        </div>

        {err && <div className="error">{err}</div>}

        <button className="btn-mini" type="submit" disabled={loading} style={{ marginTop: 10 }}>
          {loading ? "Pošiljam povabila..." : "Pošlji vsa povabila"}
        </button>
      </form>

      {results && (
        <div style={{ marginTop: 20 }}>
          <div className="page-sub">
            Poslano: <b>{sentCount}</b> &nbsp;|&nbsp; Napake: <b>{errorCount}</b>
          </div>

          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Koda</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Razlog</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.code}</td>
                    <td>{r.email}</td>
                    <td>
                      <span className={r.status === "sent" ? "pill pill-on" : "pill pill-off"}>
                        {r.status === "sent" ? "POSLANO" : "NAPAKA"}
                      </span>
                    </td>
                    <td>{r.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}