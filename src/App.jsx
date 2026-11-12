import { useEffect, useState } from "react";
import Login from "./Login.jsx";
import Portal from "./Portal.jsx";
import ConfirmInvitePage from "./ConfirmInvitePage.jsx";
import RequestPinResetPage from "./RequestPinResetPage.jsx";
import ResetPinPage from "./ResetPinPage.jsx";
import { getToken, clearToken, api } from "./api.js";

const AUTH_ROUTES = {
  "/potrdi-vabilo": ConfirmInvitePage,
  "/pozabljen-pin": RequestPinResetPage,
  "/ponastavi-pin": ResetPinPage,
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const path = window.location.pathname;
  const AuthPage = AUTH_ROUTES[path];

  useEffect(() => {
    // Nove auth strani (invite/reset) ne rabijo starega ID+PIN preverjanja
    if (AuthPage) {
      setReady(true);
      return;
    }
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
  }, [AuthPage]);

  if (!ready) return null;
  if (AuthPage) {
    return <AuthPage />;
  }
  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }
  return <Portal onLogout={() => { clearToken(); setAuthed(false); }} />;
}