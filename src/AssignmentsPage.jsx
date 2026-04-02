import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState("");

  const [hunterId, setHunterId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("active");

  const [saving, setSaving] = useState(false);

  async function loadAssignments() {
    setLoading(true);
    setErr("");
    try {
      const out = await api("/ld/hunter-assignments");
      setAssignments(Array.isArray(out?.assignments) ? out.assignments : []);
    } catch (e) {
      setErr(e.message);
      setAssignments([]);
    } finally {
      setLoading(false);
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

  async function reloadAll() {
    await Promise.all([loadAssignments(), loadUsers()]);
  }

  useEffect(() => {
    reloadAll();
  }, []);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), "sl")
    );
  }, [users]);

  function resetForm() {
    setEditingId("");
    setHunterId("");
    setTitle("");
    setDescription("");
    setLocation("");
    setCategory("");
    setStatus("active");
  }

  function openAdd() {
    resetForm();
    setShowAdd(true);
  }

  function openEdit(item) {
    setEditingId(item.id || "");
    setHunterId(item.hunterId || "");
    setTitle(item.title || "");
    setDescription(item.description || "");
    setLocation(item.location || "");
    setCategory(item.category || "");
    setStatus(item.status || "active");
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false);
    resetForm();
  }

  async function saveAssignment(e) {
    e.preventDefault();
    setErr("");

    const payload = {
      hunterId: String(hunterId || "").trim(),
      title: String(title || "").trim(),
      description: String(description || "").trim(),
      location: String(location || "").trim(),
      category: String(category || "").trim(),
      status: String(status || "active").trim(),
    };

    if (!payload.hunterId) {
      setErr("Izberi lovca.");
      return;
    }

    if (!payload.title) {
      setErr("Vpiši naslov zadolžitve.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await api(`/ld/hunter-assignments/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await api("/ld/hunter-assignments", {
          method: "POST",
          body: payload,
        });
      }

      closeModal();
      await loadAssignments();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(item) {
    setErr("");
    const ok = confirm(
      `Odstranim zadolžitev "${item.title}" za ${item.hunterName || item.hunterId}?`
    );
    if (!ok) return;

    try {
      await api(`/ld/hunter-assignments/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      await loadAssignments();
    } catch (e) {
      setErr(e.message);
    }
  }

  function statusBadge(value) {
    const s = String(value || "").trim().toLowerCase();
    if (s === "done") {
      return <span className="pill pill-on">DONE</span>;
    }
    if (s === "inactive") {
      return <span className="pill pill-off">INACTIVE</span>;
    }
    return <span className="pill pill-on">ACTIVE</span>;
  }

  return (
    <>
      <div className="page-sub" style={{ marginBottom: 10 }}>
        Moderator lahko članom dodeli zadolžitve, ki so nato vidne tudi v mobilni aplikaciji v profilu.
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
        <button className="btn-mini" onClick={openAdd}>
          Dodaj zadolžitev
        </button>

        <button className="btn-mini" onClick={reloadAll}>
          Osveži
        </button>
      </div>

      {showAdd && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {editingId ? "Uredi zadolžitev" : "Dodaj zadolžitev"}
            </h3>

            <form onSubmit={saveAssignment}>
              <div className="field">
                <div className="label">Lovec *</div>
                <select
                  className="input"
                  value={hunterId}
                  onChange={(e) => setHunterId(e.target.value)}
                  disabled={loadingUsers || !!editingId}
                >
                  <option value="">
                    {loadingUsers ? "Nalagam lovce..." : "Izberi lovca"}
                  </option>
                  {sortedUsers.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
                {editingId && (
                  <div className="page-sub" style={{ marginTop: 6 }}>
                    Pri urejanju je lovec zaklenjen. Če želiš drugo osebo, ustvari novo zadolžitev.
                  </div>
                )}
              </div>

              <div className="field">
                <div className="label">Naslov *</div>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="npr. Krmilnik"
                />
              </div>

              <div className="field">
                <div className="label">Kategorija</div>
                <input
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="npr. krmilnik, preža, solnica, revir"
                />
              </div>

              <div className="field">
                <div className="label">Lokacija</div>
                <input
                  className="input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="npr. Revir 2"
                />
              </div>

              <div className="field">
                <div className="label">Opis</div>
                <textarea
                  className="input"
                  rows={4}
                  style={{
                    height: "auto",
                    paddingTop: 10,
                    paddingBottom: 10,
                    resize: "vertical",
                  }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kratek opis zadolžitve..."
                />
              </div>

              <div className="field">
                <div className="label">Status</div>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">active</option>
                  <option value="done">done</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="btn-mini"
                  onClick={closeModal}
                  style={{ opacity: 0.85 }}
                >
                  Zapri
                </button>
                <button className="btn-mini" type="submit" disabled={saving}>
                  {saving ? "Shranjujem..." : editingId ? "Shrani spremembe" : "Ustvari"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Lovec</th>
              <th>Naslov</th>
              <th>Kategorija</th>
              <th>Lokacija</th>
              <th>Status</th>
              <th style={{ width: 260 }}>Akcije</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: 14 }}>
                  Nalagam...
                </td>
              </tr>
            ) : assignments.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 14 }}>
                  Ni zadolžitev.
                </td>
              </tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.hunterName || "—"}</b>
                    <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>
                      {a.hunterId || ""}
                    </div>
                  </td>
                  <td>
                    <b>{a.title || "—"}</b>
                    {!!a.description && (
                      <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
                        {a.description}
                      </div>
                    )}
                  </td>
                  <td>{a.category || "—"}</td>
                  <td>{a.location || "—"}</td>
                  <td>{statusBadge(a.status)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn-ghost" onClick={() => openEdit(a)}>
                        Uredi
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => deleteAssignment(a)}
                        style={{
                          borderColor: "rgba(200,0,0,.25)",
                          color: "#a01515",
                        }}
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