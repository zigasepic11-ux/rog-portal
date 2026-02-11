// src/api.js

export const API_BASE =
  import.meta.env.VITE_API_BASE?.trim() ||
  import.meta.env.VITE_API_URL?.trim() ||
  "https://rog-backend.onrender.com";

export function getToken() {
  return localStorage.getItem("rog_token");
}

export function setToken(token) {
  localStorage.setItem("rog_token", token);
}

export function clearToken() {
  localStorage.removeItem("rog_token");
}

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data?.error || `Napaka ${res.status}`);
  }

  return data;
}
