import { useEffect, useState } from "react";
import Login from "./Login.jsx";
import Portal from "./Portal.jsx";
import { getToken, clearToken, api } from "./api.js";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // če je token, preveri /auth/me
    const t = getToken();
    if (!t) {
      setAuthed(false);
      setReady(true);
      return;
    }

    api("/auth/me")
      .then(() => setAuthed(true))
      .catch(() => {
        clearToken();
        setAuthed(false);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }

  return <Portal onLogout={() => { clearToken(); setAuthed(false); }} />;
}
