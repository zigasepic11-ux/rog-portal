// src/api.js

// ✅ Nastavi base za backend.
// Če imaš Vite proxy (/api -> http://localhost:PORT), potem naj bo API_BASE = "/api"
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// ---- Token helpers ----
export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token) {
  localStorage.setItem("token", token || "");
}

export function clearToken() {
  localStorage.removeItem("token");
}

// ---- Core request helper (JSON) ----
export async function api(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const method = (opts.method || "GET").toUpperCase();
  const headers = { ...(opts.headers || {}) };

  // auth header
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = opts.body;

  // auto JSON encode
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body != null && !isFormData && typeof body === "object" && !(body instanceof Blob)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error || j?.message || `HTTP ${res.status}`);
    } catch {
      throw new Error(text?.slice(0, 200) || `HTTP ${res.status}`);
    }
  }

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Neveljaven JSON odgovor iz backend-a.");
    }
  }

  return text;
}

// ---- File download helper (PDF/CSV/XLSX) ----
export async function downloadFile(path, filename) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "GET", headers });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const blob = await res.blob();

  if (!res.ok) {
    const txt = await blob.text().catch(() => "");
    throw new Error(txt?.slice(0, 200) || `HTTP ${res.status}`);
  }

  // če backend vrača HTML (portal), je to napačen API_BASE/proxy
  if (ct.includes("text/html")) {
    const txt = await blob.text().catch(() => "");
    throw new Error(
      `Export vrača HTML (portal) namesto datoteke. Napačen API_BASE ali Vite proxy.\nPrvih 120 znakov: ${txt.slice(
        0,
        120
      )}`
    );
  }

  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = filename || "export";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

// ✅ ALIAS: da ti ne razbije obstoječih importov (apiDownload)
export const apiDownload = downloadFile;
