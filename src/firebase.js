// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signInWithCustomToken,
} from "firebase/auth";

const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Lokalno (localhost) uporabimo staging projekt (kjer teče emulator).
// V produkciji uporabimo pravi rogapp2026 config.
// Emulator ne preverja apiKey, zato je "fake-api-key" za lokalni razvoj v redu.
const firebaseConfig = isLocal
  ? {
      apiKey: "fake-api-key",
      projectId: "rog-app-staging",
    }
  : {
      apiKey: "AIzaSyBOwTam1zJ7a_wpNzwG5lN_p_Kiq2RB658",
      authDomain: "rogapp2026.firebaseapp.com",
      projectId: "rogapp2026",
      storageBucket: "rogapp2026.firebasestorage.app",
      messagingSenderId: "887438857632",
      appId: "1:887438857632:web:3fe70936ae0018f3e5c0c5",
      measurementId: "G-QWZ2DV5Q9N",
    };

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

if (isLocal) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  console.log("🔧 Firebase: povezan z LOKALNIM EMULATORJEM (rog-app-staging)");
}

// Callable wrappers za nov auth sistem (invite/confirm/resend/reset)
export const inviteMember = httpsCallable(functions, "inviteMember");
export const confirmInvite = httpsCallable(functions, "confirmInvite");
export const requestPinReset = httpsCallable(functions, "requestPinReset");
export const confirmPinReset = httpsCallable(functions, "confirmPinReset");
export const listLdMembers = httpsCallable(functions, "listLdMembers");
export const deactivateMember = httpsCallable(functions, "deactivateMember");
export const reactivateMember = httpsCallable(functions, "reactivateMember");
export const changeMemberRole = httpsCallable(functions, "changeMemberRole");
export const resendInvite = httpsCallable(functions, "resendInvite");
export const setMemberBoardFlag = httpsCallable(functions, "setMemberBoardFlag");
export const bulkInviteLegacyMembers = httpsCallable(functions, "bulkInviteLegacyMembers");

// Prijava z email + PIN (PIN = Firebase Auth geslo)
export async function loginWithEmailPin(email, pin) {
  const userCredential = await signInWithEmailAndPassword(auth, email, pin);
  const idToken = await userCredential.user.getIdToken();
  return idToken;
}

// Za stare (ID+PIN) uporabnike: vzpostavi vzporedno Firebase Auth sejo preko
// custom tokena, ki ga stari /auth/login endpoint že vrača. To omogoča, da
// tudi moderatorji, prijavljeni po starem sistemu, lahko kličejo nove
// zavarovane Cloud Functions (npr. inviteMember).
export async function bridgeLegacyLogin(firebaseCustomToken) {
  await signInWithCustomToken(auth, firebaseCustomToken);
}