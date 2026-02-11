// src/UsersPage.jsx
import { useEffect, useState } from "react";
import { api } from "./api.js";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [createdPin, setCreatedPin] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const out = await api("/ld/users");
      setUsers(out.users || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleEnabled(u) {
    setErr("");
    try {
      await api(`/ld/users/${encodeURIComponent(u.code)}`, {
        method: "PATCH",
        body: { enabled: !u.enabled },
      });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function resetPin(u) {
    setErr("");
    try {
      const out = await api(`/ld/users/${encodeURIComponent(u.code)}/reset-pin`, {
        method: "POST",
      });
      alert(`NOV PIN za ${u.name} (${u.code}): ${out.pin}`);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function removeUser(u) {
    setErr("");
    const ok = confirm(`Odstranim uporabnika ${u.name} (${u.code})?\n\nTo ga bo DISABLE (ne izbriše trajno).`);
    if (!ok) return;

    try {
      await api(`/ld/users/${encodeURIComponent(u.code)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    setErr("");
    setCreatedPin("");

    try {
      const out = await api("/ld/users", {
        method: "POST",
        body: { code: code.trim(), name: name.trim(), role },
      });

      setCreatedPin(out.pin || "");
      setCode("");
      setName("");
      setRole("member");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <div className="page-sub" style={{ marginBottom: 10 }}>
        Seznam članov za tvojo LD. Tukaj dodajaš uporabnike, omogočiš/onemogočiš račun, resetiraš PIN in odstraniš uporabnika (disable).
      </div>

      {err && <div className="error">{err}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="btn-mini" onClick={() => setShowAdd(true)}>
          Dodaj uporabnika
        </button>
        <button className="btn-mini" onClick={load}>
          Osveži
        </button>
      </div>

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Dodaj uporabnika</h3>

            <form onSubmit={createUser}>
              <div className="field">
                <div className="label">Koda (doc ID) *</div>
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="npr. 1001 ali lovec_01"
                />
              </div>

              <div className="field">
                <div className="label">Ime in priimek *</div>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="npr. Janez Novak"
                />
              </div>

              <div className="field">
                <div className="label">Vloga</div>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">member</option>
                  <option value="moderator">moderator</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-mini" onClick={() => setShowAdd(false)} style={{ opacity: 0.85 }}>
                  Zapri
                </button>
                <button className="btn-mini" type="submit">
                  Ustvari
                </button>
              </div>
            </form>

            {createdPin && (
              <div className="pin-box" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900 }}>Začetni PIN</div>
                <div className="pin-value">{createdPin}</div>
                <div className="page-sub" style={{ marginTop: 6 }}>
                  Ta PIN pokaži uporabniku. Kasneje ga lahko resetiraš.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Koda</th>
              <th>Ime</th>
              <th>Vloga</th>
              <th>Status</th>
              <th style={{ width: 320 }}>Akcije</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ padding: 14 }}>
                  Nalagam...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: 14 }}>
                  Ni uporabnikov.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.code}>
                  <td>
                    <b>{u.code}</b>
                  </td>
                  <td>{u.name}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={u.enabled ? "pill pill-on" : "pill pill-off"}>
                      {u.enabled ? "ENABLED" : "DISABLED"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn-ghost" onClick={() => toggleEnabled(u)}>
                        {u.enabled ? "Onemogoči" : "Omogoči"}
                      </button>

                      <button className="btn-ghost" onClick={() => resetPin(u)}>
                        Reset PIN
                      </button>

                      <button
                        className="btn-ghost"
                        onClick={() => removeUser(u)}
                        style={{ borderColor: "rgba(200,0,0,.25)", color: "#a01515" }}
                      >
                        Odstrani
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
