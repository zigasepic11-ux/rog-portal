import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("sl-SI");
  } catch {
    return "—";
  }
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function WorkHoursPage() {
  const thisYear = new Date().getFullYear();

  const [year, setYear] = useState(thisYear);

  const [overview, setOverview] = useState([]);
  const [actions, setActions] = useState([]);
  const [users, setUsers] = useState([]);

  const [entries, setEntries] = useState([]);
  const [selectedAction, setSelectedAction] = useState(null);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingActions, setLoadingActions] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [err, setErr] = useState("");

  const [editingHunterId, setEditingHunterId] = useState(null);
  const [plannedHours, setPlannedHours] = useState("");

  const [showAddAction, setShowAddAction] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [actionStartsAt, setActionStartsAt] = useState("");
  const [actionLocation, setActionLocation] = useState("");
  const [actionExpectedHours, setActionExpectedHours] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  const [entryHours, setEntryHours] = useState({});
  const [entryNotes, setEntryNotes] = useState({});
  const [savingEntryHunterId, setSavingEntryHunterId] = useState("");
  const [closingAction, setClosingAction] = useState(false);

  async function loadOverview() {
    setLoadingOverview(true);
    try {
      const out = await api(`/ld/work-hours/overview?year=${encodeURIComponent(year)}`);
      setOverview(Array.isArray(out?.rows) ? out.rows : []);
    } catch (e) {
      setErr(e.message);
      setOverview([]);
    } finally {
      setLoadingOverview(false);
    }
  }

  async function loadActions() {
    setLoadingActions(true);
    try {
      const out = await api(`/ld/work-actions?year=${encodeURIComponent(year)}`);
      const rows = Array.isArray(out?.actions) ? out.actions : [];
      setActions(rows);
    } catch (e) {
      setErr(e.message);
      setActions([]);
    } finally {
      setLoadingActions(false);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const out = await api("/ld/users");
      setUsers(Array.isArray(out?.users) ? out.users : []);
    } catch (e) {
      setErr(e.message);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadEntries(actionId) {
    if (!actionId) return;
    setLoadingEntries(true);
    try {
      const out = await api(`/ld/work-actions/${encodeURIComponent(actionId)}/entries`);
      const rows = Array.isArray(out?.entries) ? out.entries : [];
      setEntries(rows);

      const hoursMap = {};
      const notesMap = {};
      rows.forEach((r) => {
        hoursMap[r.hunterId] = r.hours ?? "";
        notesMap[r.hunterId] = r.notes ?? "";
      });
      setEntryHours(hoursMap);
      setEntryNotes(notesMap);
    } catch (e) {
      setErr(e.message);
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }

  async function reloadAll() {
    setErr("");
    await Promise.all([loadOverview(), loadActions(), loadUsers()]);
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    if (selectedAction?.id) {
      loadEntries(selectedAction.id);
    } else {
      setEntries([]);
      setEntryHours({});
      setEntryNotes({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAction?.id]);

  function startEditPlan(row) {
    setEditingHunterId(row.hunterId);
    setPlannedHours(String(row.plannedHours ?? 0));
  }

  function cancelEditPlan() {
    setEditingHunterId(null);
    setPlannedHours("");
  }

  async function savePlan(row) {
    setErr("");
    try {
      await api("/ld/work-hours/plan", {
        method: "POST",
        body: {
          hunterId: row.hunterId,
          plannedHours: Number(plannedHours || 0),
          year,
        },
      });

      cancelEditPlan();
      await loadOverview();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function createAction(e) {
    e.preventDefault();
    setErr("");

    const title = String(actionTitle || "").trim();
    const startsAt = String(actionStartsAt || "").trim();

    if (!title) return setErr("Vpiši naslov akcije.");
    if (!startsAt) return setErr("Izberi datum/uro akcije.");

    try {
      setSavingAction(true);

      await api("/ld/work-actions", {
        method: "POST",
        body: {
          title,
          startsAt: new Date(startsAt).toISOString(),
          location: String(actionLocation || "").trim(),
          expectedHours: Number(actionExpectedHours || 0),
          description: String(actionDescription || "").trim(),
          status: "open",
        },
      });

      setActionTitle("");
      setActionStartsAt("");
      setActionLocation("");
      setActionExpectedHours("");
      setActionDescription("");
      setShowAddAction(false);

      await loadActions();
      await loadOverview();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSavingAction(false);
    }
  }

  async function saveEntry(hunter) {
    if (!selectedAction?.id) return;
    if (selectedAction?.status === "closed") return;
    setErr("");

    try {
      setSavingEntryHunterId(hunter.code);

      await api(`/ld/work-actions/${encodeURIComponent(selectedAction.id)}/entries`, {
        method: "POST",
        body: {
          hunterId: hunter.code,
          hours: Number(entryHours[hunter.code] || 0),
          notes: String(entryNotes[hunter.code] || "").trim(),
        },
      });

      await loadEntries(selectedAction.id);
      await loadOverview();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingEntryHunterId("");
    }
  }

  async function closeSelectedAction() {
    if (!selectedAction?.id) return;
    setErr("");

    try {
      setClosingAction(true);

      await api(`/ld/work-actions/${encodeURIComponent(selectedAction.id)}/status`, {
        method: "PATCH",
        body: {
          status: "closed",
        },
      });

      const updated = { ...selectedAction, status: "closed" };
      setSelectedAction(updated);
      await loadActions();
    } catch (e) {
      setErr(e.message);
    } finally {
      setClosingAction(false);
    }
  }

  const entriesByHunter = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      map[e.hunterId] = e;
    });
    return map;
  }, [entries]);

  return (
    <>
      <div className="page-sub" style={{ marginBottom: 10 }}>
        Modul za evidenco delovnih ur članov. Nastavi plan ur, dodaj delovne akcije in vpiši opravljene ure.
      </div>

      {err && <div className="error">{err}</div>}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="label" style={{ marginBottom: 0 }}>
            Leto
          </div>
          <input
            className="input"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value || thisYear))}
            style={{ width: 110, height: 42 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-mini" onClick={reloadAll}>
            Osveži
          </button>
          <button className="btn-mini" onClick={() => setShowAddAction(true)}>
            Dodaj delovno akcijo
          </button>
        </div>
      </div>

      {showAddAction && (
        <div className="modal-backdrop" onClick={() => setShowAddAction(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Dodaj delovno akcijo</h3>

            <form onSubmit={createAction}>
              <div className="field">
                <div className="label">Naslov akcije *</div>
                <input
                  className="input"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="npr. Čiščenje krmišč"
                />
              </div>

              <div className="field">
                <div className="label">Začetek *</div>
                <input
                  className="input"
                  type="datetime-local"
                  value={actionStartsAt}
                  onChange={(e) => setActionStartsAt(e.target.value)}
                />
              </div>

              <div className="field">
                <div className="label">Lokacija</div>
                <input
                  className="input"
                  value={actionLocation}
                  onChange={(e) => setActionLocation(e.target.value)}
                  placeholder="npr. Revir 2"
                />
              </div>

              <div className="field">
                <div className="label">Predvidene ure</div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={actionExpectedHours}
                  onChange={(e) => setActionExpectedHours(e.target.value)}
                  placeholder="npr. 4"
                />
              </div>

              <div className="field">
                <div className="label">Opis</div>
                <textarea
                  className="input"
                  rows={4}
                  style={{ height: "auto", paddingTop: 10, paddingBottom: 10, resize: "vertical" }}
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  placeholder="Kratek opis dela..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn-mini"
                  onClick={() => setShowAddAction(false)}
                  style={{ opacity: 0.85 }}
                >
                  Zapri
                </button>
                <button className="btn-mini" type="submit" disabled={savingAction}>
                  {savingAction ? "Shranjujem..." : "Ustvari akcijo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="stat" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 10 }}>Pregled članov in ur</h4>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Koda</th>
                <th>Ime</th>
                <th>Vloga</th>
                <th>Plan ur</th>
                <th>Opravljeno</th>
                <th>Manjka</th>
                <th>Presežek</th>
                <th style={{ width: 220 }}>Akcije</th>
              </tr>
            </thead>

            <tbody>
              {loadingOverview ? (
                <tr>
                  <td colSpan="8" style={{ padding: 14 }}>
                    Nalagam...
                  </td>
                </tr>
              ) : overview.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: 14 }}>
                    Ni podatkov.
                  </td>
                </tr>
              ) : (
                overview.map((r) => (
                  <tr key={r.hunterId}>
                    <td>
                      <b>{r.hunterCode}</b>
                    </td>
                    <td>{r.name}</td>
                    <td>{r.role}</td>

                    <td>
                      {editingHunterId === r.hunterId ? (
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.5"
                          value={plannedHours}
                          onChange={(e) => setPlannedHours(e.target.value)}
                          style={{ width: 90, height: 38 }}
                        />
                      ) : (
                        num(r.plannedHours)
                      )}
                    </td>

                    <td>{num(r.doneHours)}</td>
                    <td>{num(r.missingHours)}</td>
                    <td>{num(r.extraHours)}</td>

                    <td>
                      {editingHunterId === r.hunterId ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn-ghost" onClick={() => savePlan(r)}>
                            Shrani
                          </button>
                          <button className="btn-ghost" onClick={cancelEditPlan}>
                            Prekliči
                          </button>
                        </div>
                      ) : (
                        <button className="btn-ghost" onClick={() => startEditPlan(r)}>
                          Nastavi plan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stat" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <h4 style={{ margin: 0 }}>Delovne akcije</h4>
          <div className="desc">Klikni akcijo za vnos ur po članih.</div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Naslov</th>
                <th>Lokacija</th>
                <th>Status</th>
                <th>Predvidene ure</th>
                <th style={{ width: 180 }}>Akcije</th>
              </tr>
            </thead>

            <tbody>
              {loadingActions ? (
                <tr>
                  <td colSpan="6" style={{ padding: 14 }}>
                    Nalagam...
                  </td>
                </tr>
              ) : actions.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: 14 }}>
                    Ni delovnih akcij.
                  </td>
                </tr>
              ) : (
                actions.map((a) => (
                  <tr key={a.id}>
                    <td>{fmt(a.startsAt)}</td>
                    <td>
                      <b>{a.title || "—"}</b>
                      {!!a.description && (
                        <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
                          {a.description}
                        </div>
                      )}
                    </td>
                    <td>{a.location || "—"}</td>
                    <td>{a.status || "open"}</td>
                    <td>{num(a.expectedHours)}</td>
                    <td>
                      <button
                        className="btn-ghost"
                        onClick={() => setSelectedAction(a)}
                      >
                        {a.status === "closed" ? "Poglej" : "Vnesi ure"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stat">
        <h4 style={{ marginBottom: 10 }}>
          {selectedAction
            ? `Vnos ur za akcijo: ${selectedAction.title}`
            : "Vnos ur po akciji"}
        </h4>

        {!selectedAction ? (
          <div className="desc">Izberi delovno akcijo iz zgornje tabele.</div>
        ) : loadingUsers ? (
          <div className="desc">Nalagam člane...</div>
        ) : (
          <>
            <div className="page-sub" style={{ marginBottom: 10 }}>
              Datum: {fmt(selectedAction.startsAt)} {selectedAction.location ? `• Lokacija: ${selectedAction.location}` : ""}
              {" • "}
              Status: <b>{selectedAction.status || "open"}</b>
            </div>

            {selectedAction?.status !== "closed" && (
              <div style={{ marginBottom: 12 }}>
                <button className="btn-mini" onClick={closeSelectedAction} disabled={closingAction}>
                  {closingAction ? "Zaključujem..." : "Zaključi akcijo"}
                </button>
              </div>
            )}

            {loadingEntries ? (
              <div className="desc">Nalagam vnose...</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Koda</th>
                      <th>Ime</th>
                      <th>Ure</th>
                      <th>Opomba</th>
                      <th>Obstoječi vnos</th>
                      <th style={{ width: 160 }}>Akcije</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: 14 }}>
                          Ni članov.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const existing = entriesByHunter[u.code];
                        const currentHours =
                          entryHours[u.code] !== undefined
                            ? entryHours[u.code]
                            : existing?.hours ?? "";
                        const currentNotes =
                          entryNotes[u.code] !== undefined
                            ? entryNotes[u.code]
                            : existing?.notes ?? "";

                        return (
                          <tr key={u.code}>
                            <td>
                              <b>{u.code}</b>
                            </td>
                            <td>{u.name}</td>

                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.5"
                                value={currentHours}
                                disabled={selectedAction?.status === "closed"}
                                onChange={(e) =>
                                  setEntryHours((prev) => ({
                                    ...prev,
                                    [u.code]: e.target.value,
                                  }))
                                }
                                style={{ width: 90, height: 38 }}
                              />
                            </td>

                            <td>
                              <input
                                className="input"
                                value={currentNotes}
                                disabled={selectedAction?.status === "closed"}
                                onChange={(e) =>
                                  setEntryNotes((prev) => ({
                                    ...prev,
                                    [u.code]: e.target.value,
                                  }))
                                }
                                placeholder="Opomba"
                                style={{ minWidth: 180, height: 38 }}
                              />
                            </td>

                            <td>
                              {existing ? (
                                <div>
                                  <div style={{ fontWeight: 700 }}>
                                    {num(existing.hours)} ur
                                  </div>
                                  {existing.notes ? (
                                    <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
                                      {existing.notes}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <span style={{ opacity: 0.6 }}>—</span>
                              )}
                            </td>

                            <td>
                              <button
                                className="btn-ghost"
                                onClick={() => saveEntry(u)}
                                disabled={savingEntryHunterId === u.code || selectedAction?.status === "closed"}
                              >
                                {selectedAction?.status === "closed"
                                  ? "Akcija zaključena"
                                  : savingEntryHunterId === u.code
                                    ? "Shranjujem..."
                                    : "Shrani ure"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}