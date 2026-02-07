// src/components/poiIcons.js
import L from "leaflet";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") + "/";

function normalizeType(t) {
  let s = String(t || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/č/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");

  // ✅ pogosti "plural"/variante iz baze / UI
  if (s === "krmisca") s = "krmisce";
  if (s === "krmice") s = "krmisce";
  if (s === "krmisce_") s = "krmisce";

  // če kdo napiše "lovska koca" ali "lovska-koča"
  if (s === "lovska_koca_" || s === "lovska-koca") s = "lovska_koca";

  return s;
}

const ICON_URLS = {
  krmisce: `${BASE}icons/points/krmisce.png`,
  krmisca: `${BASE}icons/points/krmisce.png`, // ✅ safety
  opazovalnica: `${BASE}icons/points/opazovalnica.png`,
  lovska_koca: `${BASE}icons/points/lovska_koca.png`,
  njiva: `${BASE}icons/points/njiva.png`,
  drugo: `${BASE}icons/points/drugo.png`,
};

const FALLBACK = ICON_URLS.drugo;

// cache, da Leaflet ne dela novih ikon 100x
const CACHE = new Map();

export function getPoiIcon(type) {
  const key = normalizeType(type);
  const url = ICON_URLS[key] || FALLBACK;

  if (!CACHE.has(url)) {
    CACHE.set(
      url,
      L.icon({
        iconUrl: url,
        iconSize: [30, 38],
        iconAnchor: [15, 38],
        popupAnchor: [0, -30],
      })
    );
  }

  return CACHE.get(url);
}
