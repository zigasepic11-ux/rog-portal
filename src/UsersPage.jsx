// src/UsersPage.jsx
import { useEffect, useState } from "react";
import { api } from "./api.js";
import {
  inviteMember,
  listLdMembers,
  deactivateMember,
  reactivateMember,
  changeMemberRole,
  resendInvite,
  setMemberBoardFlag,
} from "./firebase.js";

const STATUS_LABELS = {
  enabled: "AKTIVEN",
  disabled: "ONEMOGOČEN",
  active: "AKTIVEN",
  deactivated: "DEAKTIVIRAN",
  invited: "POVABLJEN",
  expired: "POTEKLO",
  pending: "V TEKU",
};

function isActiveStatus(status) {
  return status === "enabled" || status === "active";
}

export default function UsersPage() {
  const [legacyUsers, setLegacyUsers] = useState([]);
  const [newMembers, setNewMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [currentLdId, setCurrentLdId] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteSurname, setInviteSurname] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteErr, setInviteErr] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  async function loadLegacyUsers() {
    try {
      const out = await api("/ld/users");
      setLegacyUsers(out.users || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function loadNewMembers(ldId) {
    if (!ldId) return;
    try {
      const result = await listLdMembers({ ldId });
      setNewMembers(result.data.members || []);
    } catch (e) {
      setErr(e?.message || "Napaka pri nalaganju novih članov.");
    }
  }

  async function loadAll(ldId) {
    setErr("");
    setLoading(true);
    await Promise.all([loadLegacyUsers(), loadNewMembers(ldId)]);
    setLoading(false);
  }

  useEffect(() => {
    api("/auth/me")
      .then((out) => {
        const ldId = out?.user?.ldId || "";
        setCurrentLdId(ldId);
        loadAll(ldId);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  function refresh() {
    loadAll(currentLdId);
  }

  // ---- Legacy akcije ----
  async function toggleEnabled(u) {
    setErr("");
    try {
      await api(`/ld/users/${encodeURIComponent(u.code)}`, {
        method: "PATCH",
        body: { enabled: !u.enabled },
      });
      refresh();
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
      refresh();
    } catch (e) {
      setErr(e.message);
    }
  }

  // ---- Nov sistem akcije ----
  async function handleDeactivate(m) {
    const ok = confirm(`Deaktiviram člana ${m.name} (${m.email})?`);
    if (!ok) return;
    setErr("");
    try {
      await deactivateMember({ membershipId: m.membershipId });
      refresh();
    } catch (e) {
      setErr(e?.message || "Napaka pri deaktivaciji člana.");
    }
  }

  async function handleReactivate(m) {
    setErr("");
    try {
      await reactivateMember({ membershipId: m.membershipId });
      refresh();
    } catch (e) {
      setErr(e?.message || "Napaka pri ponovni aktivaciji člana.");
    }
  }

  async function handleChangeRole(m, newRole) {
    setErr("");
    try {
      await changeMemberRole({ membershipId: m.membershipId, newRole });
      refresh();
    } catch (e) {
      setErr(e?.message || "Napaka pri spremembi vloge.");
    }
  }

  async function handleResendInvite(m) {
    setErr("");
    try {
      await resendInvite({ membershipId: m.membershipId });
      alert("Povabilo je bilo ponovno poslano.");
      refresh();
    } catch (e) {
      setErr(e?.message || "Napaka pri ponovnem pošiljanju povabila.");
    }
  }

  async function handleToggleBoard(row) {
    setErr("");
    const next = row.raw.isBoardMember !== true;
    try {
      if (row.source === "legacy") {
        await api(`/ld/users/${encodeURIComponent(row.raw.code)}`, {
          method: "PATCH",
          body: { isBoardMember: next },
        });
      } else {
        await setMemberBoardFlag({
          membershipId: row.raw.membershipId,
          isBoardMember: next,
        });
      }
      refresh();
    } catch (e) {
      setErr(e?.message || "Napaka pri spremembi clanstva v upravnem odboru.");
    }
  }

  // ---- Invite obrazec ----
  async function sendInvite(e) {
    e.preventDefault();
    setInviteErr("");

    if (!inviteEmail.trim()) {
      setInviteErr("Email je obvezen.");
      return;
    }
    if (!currentLdId) {
      setInviteErr("Ni bilo mogoče ugotoviti vaše lovske družine. Poskusite se znova prijaviti.");
      return;
    }

    setInviteLoading(true);
    try {
      await inviteMember({
        ldId: currentLdId,
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        surname: inviteSurname.trim(),
        role: inviteRole,
      });
      setInviteSuccess(true);
      setInviteEmail("");
      setInviteName("");
      setInviteSurname("");
      setInviteRole("member");
      refresh();
    } catch (e) {
      const code = e?.code || "";
      if (code.includes("permission-denied")) {
        setInviteErr("Nimate pravic za povabilo članov v to lovsko družino.");
      } else if (code.includes("already-exists")) {
        setInviteErr("Ta oseba je že aktivni član te lovske družine.");
      } else if (code.includes("unauthenticated")) {
        setInviteErr("Prijava za nov sistem ni bila vzpostavljena. Poskusite se znova prijaviti.");
      } else {
        setInviteErr(e?.message || "Napaka pri pošiljanju povabila.");
      }
    } finally {
      setInviteLoading(false);
    }
  }

  // ---- Združen seznam za prikaz ----
  const legacyRows = legacyUsers.map((u) => ({
    source: "legacy",
    id: u.code,
    identifier: u.code,
    name: u.name,
    role: u.role,
    status: u.enabled ? "enabled" : "disabled",
    raw: u,
  }));

  const newRows = newMembers.map((m) => ({
    source: "new",
    id: m.membershipId,
    identifier: m.email,
    name: `${m.name || ""} ${m.surname || ""}`.trim() || "(brez imena)",
    role: m.role,
    status: m.status,
    raw: m,
  }));

  const allRows = [...legacyRows, ...newRows].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "sl")
  );

  return (
    <>
      <div className="page-sub" style={{ marginBottom: 10 }}>
        Seznam vseh članov za tvojo LD - stari (ID + PIN) in novi (email + PIN) sistem skupaj.
      </div>

      {err && <div className="error">{err}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          className="btn-mini"
          onClick={() => { setShowInvite(true); setInviteSuccess(false); setInviteErr(""); }}
        >
          Povabi po emailu
        </button>
        <button className="btn-mini" onClick={refresh}>
          Osveži
        </button>
      </div>

      {showInvite && (
        <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Povabi po emailu</h3>
            <div className="page-sub" style={{ marginBottom: 12 }}>
              Nov, varen način dodajanja članov - oseba prejme email z
              vabilom in si sama nastavi PIN.
            </div>

            {inviteSuccess ? (
              <>
                <div className="page-sub">
                  ✅ Vabilo je bilo uspešno poslano. Oseba bo prejela email
                  z navodili za nastavitev PIN-a v naslednjih 48 urah.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button className="btn-mini" onClick={() => setShowInvite(false)}>
                    Zapri
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={sendInvite}>
                <div className="field">
                  <div className="label">Email *</div>
                  <input
                    className="input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="lovec@email.si"
                    type="email"
                  />
                </div>

                <div className="field">
                  <div className="label">Ime</div>
                  <input
                    className="input"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="npr. Janez"
                  />
                </div>

                <div className="field">
                  <div className="label">Priimek</div>
                  <input
                    className="input"
                    value={inviteSurname}
                    onChange={(e) => setInviteSurname(e.target.value)}
                    placeholder="npr. Novak"
                  />
                </div>

                <div className="field">
                  <div className="label">Vloga</div>
                  <select
                    className="input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">member</option>
                    <option value="moderator">moderator</option>
                  </select>
                </div>

                {inviteErr && <div className="error">{inviteErr}</div>}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => setShowInvite(false)}
                    style={{ opacity: 0.85 }}
                  >
                    Prekliči
                  </button>
                  <button className="btn-mini" type="submit" disabled={inviteLoading}>
                    {inviteLoading ? "Pošiljam..." : "Pošlji vabilo"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Ime</th>
              <th>Koda / Email</th>
              <th>Vloga</th>
              <th>Upravni odbor</th>
              <th>Status</th>
              <th style={{ width: 320 }}>Akcije</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: 14 }}>
                  Nalagam...
                </td>
              </tr>
            ) : allRows.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 14 }}>
                  Ni uporabnikov.
                </td>
              </tr>
            ) : (
              allRows.map((row) => (
                <tr key={`${row.source}-${row.id}`}>
                  <td>
                    <b>{row.name}</b>
                  </td>
                  <td>{row.identifier}</td>
                  <td>{row.role}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.raw.isBoardMember === true}
                      disabled={!(row.source === "legacy" || row.status === "active")}
                      onChange={() => handleToggleBoard(row)}
                      title="Clan upravnega odbora"
                    />
                  </td>
                  <td>
                    <span className={isActiveStatus(row.status) ? "pill pill-on" : "pill pill-off"}>
                      {STATUS_LABELS[row.status] || row.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {row.source === "legacy" && (
                        <>
                          <button className="btn-ghost" onClick={() => toggleEnabled(row.raw)}>
                            {row.raw.enabled ? "Onemogoči" : "Omogoči"}
                          </button>
                          <button className="btn-ghost" onClick={() => resetPin(row.raw)}>
                            Reset PIN
                          </button>
                        </>
                      )}

                      {row.source === "new" && row.status === "active" && (
                        <>
                          <button
                            className="btn-ghost"
                            onClick={() =>
                              handleChangeRole(row.raw, row.role === "moderator" ? "member" : "moderator")
                            }
                          >
                            {row.role === "moderator" ? "Naredi member" : "Naredi moderator"}
                          </button>
                          <button
                            className="btn-ghost"
                            onClick={() => handleDeactivate(row.raw)}
                            style={{ borderColor: "rgba(200,0,0,.25)", color: "#a01515" }}
                          >
                            Deaktiviraj
                          </button>
                        </>
                      )}

                      {row.source === "new" && row.status === "deactivated" && (
                        <button className="btn-ghost" onClick={() => handleReactivate(row.raw)}>
                          Aktiviraj
                        </button>
                      )}

                      {row.source === "new" && (row.status === "invited" || row.status === "expired") && (
                        <button className="btn-ghost" onClick={() => handleResendInvite(row.raw)}>
                          Ponovno pošlji povabilo
                        </button>
                      )}
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