// src/components/BoundaryMap.jsx
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { api } from "../api.js";

// ===== POINT ICONS (iz public/icons/points/...) =====

const ICONS = {
  krmisce: "/icons/points/krmisce.png",
  opazovalnica: "/icons/points/opazovalnica.png",
  lovska_koca: "/icons/points/lovska_koca.png",
  njiva: "/icons/points/njiva.png",
  drugo: "/icons/points/drugo.png",
};

const FALLBACK_ICON = "/icons/points/drugo.png";

function normalizeType(t) {
  return String(t || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/č/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

const ICON_CACHE = new Map();

function getPointIcon(type) {
  const key = normalizeType(type);
  const url = ICONS[key] || FALLBACK_ICON;

  if (!ICON_CACHE.has(url)) {
    ICON_CACHE.set(
      url,
      L.icon({
        iconUrl: url,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -30],
      })
    );
  }

  return ICON_CACHE.get(url);
}

// ===== Robust number parsing =====

function parseNumber(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function coercePoint(p) {
  const lat = parseNumber(p?.lat);
  const lng = parseNumber(p?.lng);

  return {
    ...p,
    lat,
    lng,
    _typeNorm: normalizeType(p?.type) || "drugo",
    _validLatLng: lat != null && lng != null,
  };
}

// ===== Helpers =====

function FitBounds({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!data) return;
    const layer = L.geoJSON(data);
    const b = layer.getBounds();
    if (b && b.isValid()) {
      map.fitBounds(b, { padding: [24, 24] });
    }
  }, [data, map]);

  return null;
}

function LayerButtons({ layer, setLayer }) {
  const btnStyle = (active) => ({
    border: "1px solid rgba(107,78,46,.35)",
    background: active ? "rgba(107,78,46,.12)" : "rgba(255,255,255,.75)",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 900,
    color: "#6B4E2E",
    cursor: active ? "default" : "pointer",
    opacity: active ? 0.85 : 1,
  });

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        top: 12,
        left: 12,
        display: "flex",
        gap: 8,
        padding: 8,
        borderRadius: 14,
        background: "rgba(255,255,255,0.65)",
        backdropFilter: "blur(6px)",
        boxShadow: "0 8px 26px rgba(0,0,0,0.14)",
      }}
    >
      <button style={btnStyle(layer === "map")} onClick={() => setLayer("map")} disabled={layer === "map"}>
        Zemljevid
      </button>
      <button style={btnStyle(layer === "topo")} onClick={() => setLayer("topo")} disabled={layer === "topo"}>
        Topo
      </button>
      <button style={btnStyle(layer === "sat")} onClick={() => setLayer("sat")} disabled={layer === "sat"}>
        Satelit
      </button>
    </div>
  );
}

export default function BoundaryMap({ geoJsonUrl }) {
  const [boundary, setBoundary] = useState(null);
  const [boundaryErr, setBoundaryErr] = useState("");

  const [points, setPoints] = useState([]);
  const [pointsErr, setPointsErr] = useState("");

  const [layer, setLayer] = useState("map"); // "map" | "topo" | "sat"

  // ✅ Debug prikaz samo če eksplicitno vklopiš (Vite env):
  const DEBUG = String(import.meta?.env?.VITE_DEBUG || "").trim() === "1";

  // ✅ Filter tipov točk (ikone)
  const [typeFilter, setTypeFilter] = useState({
    krmisce: true,
    opazovalnica: true,
    lovska_koca: true,
    njiva: true,
    drugo: true,
  });

  // 1) Load boundary GeoJSON
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setBoundaryErr("");
        setBoundary(null);
        if (!geoJsonUrl) return;

        const res = await fetch(geoJsonUrl);
        if (!res.ok) throw new Error("Ne morem naložiti meje.");
        const json = await res.json();
        if (!cancelled) setBoundary(json);
      } catch (e) {
        if (!cancelled) setBoundaryErr(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geoJsonUrl]);

  // 2) Load points from backend (/ld/points)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPointsErr("");
        setPoints([]);

        const out = await api("/ld/points");
        const arr = Array.isArray(out?.points) ? out.points : [];

        if (!cancelled) {
          setPoints(arr);
        }
      } catch (e) {
        if (!cancelled) {
          setPointsErr(e?.message || String(e));
          setPoints([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ normalize points (lat/lng robust)
  const normalizedPoints = useMemo(() => {
    const arr = Array.isArray(points) ? points : [];
    return arr.map(coercePoint);
  }, [points]);

  // ✅ diagnostics (da ni “tiho”)
  const diag = useMemo(() => {
    const total = normalizedPoints.length;
    const valid = normalizedPoints.filter((p) => p._validLatLng).length;
    const invalid = total - valid;

    const byType = {};
    for (const p of normalizedPoints) {
      const t = p._typeNorm || "drugo";
      byType[t] = (byType[t] || 0) + 1;
    }

    return { total, valid, invalid, byType };
  }, [normalizedPoints]);

  const filteredPoints = useMemo(() => {
    return normalizedPoints
      .filter((p) => p._validLatLng)
      .filter((p) => typeFilter[p._typeNorm] !== false);
  }, [normalizedPoints, typeFilter]);

  const showHeader = DEBUG || !!pointsErr || !!boundaryErr || diag.invalid > 0;

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
        background: "white",
      }}
    >
      {/* Header info */}
      {showHeader ? (
        <div style={{ padding: 12, borderBottom: "1px solid rgba(107,78,46,.15)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, color: "#6B4E2E" }}>
              Točk (skupaj): {diag.total} | veljavne lat/lng: {diag.valid} | neveljavne: {diag.invalid}
            </div>
            {pointsErr ? <div style={{ color: "#B42318", fontWeight: 800 }}>Napaka točk: {pointsErr}</div> : null}
            {boundaryErr ? <div style={{ color: "#B42318", fontWeight: 800 }}>Napaka meje: {boundaryErr}</div> : null}
            {DEBUG ? (
              <div style={{ opacity: 0.75, fontSize: 12 }}>
                Types:{" "}
                {Object.keys(diag.byType)
                  .sort()
                  .map((k) => `${k}:${diag.byType[k]}`)
                  .join("  ")}
              </div>
            ) : null}
          </div>

          {/* če imaš invalid, pokažemo primer (da takoj vidiš kaj je narobe) */}
          {diag.invalid > 0 ? (
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
              Opomba: del točk ima neveljavne koordinate (lat/lng). Točke z invalid koordinatami se ne rišejo.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Filter ikonic */}
      <div style={{ padding: 12, borderBottom: "1px solid rgba(107,78,46,.12)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 950, color: "#6B4E2E" }}>Filtri točk</div>

          {Object.keys(typeFilter).map((k) => (
            <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 850, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={typeFilter[k]}
                onChange={(e) => setTypeFilter((s) => ({ ...s, [k]: e.target.checked }))}
              />
              {k}
            </label>
          ))}

          <div style={{ marginLeft: "auto", fontWeight: 900, color: "#6B4E2E", fontSize: 12 }}>
            Prikazanih: {filteredPoints.length}
          </div>
        </div>
      </div>

      {/* Map */}
      <div
        style={{
          height: "70vh",
          position: "relative",
          background: "white",
        }}
      >
        <MapContainer style={{ height: "100%", width: "100%" }} center={[46.1, 14.9]} zoom={10}>
          <LayerButtons layer={layer} setLayer={setLayer} />

          {layer === "map" && (
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          )}

          {layer === "topo" && (
            <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="&copy; OpenTopoMap" />
          )}

          {layer === "sat" && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
            />
          )}

          {/* Boundary */}
          {boundary ? (
            <>
              <GeoJSON data={boundary} style={{ weight: 4, fillOpacity: 0.08 }} />
              <FitBounds data={boundary} />
            </>
          ) : null}

          {/* Points */}
          {filteredPoints.map((p) => {
            // safety: ne renderaj, če karkoli ni ok
            if (p.lat == null || p.lng == null) return null;

            const key = String(p.id || p.pointId || `${p.lat},${p.lng}`);
            return (
              <Marker key={key} position={[p.lat, p.lng]} icon={getPointIcon(p.type)}>
                <Popup>
                  <div style={{ fontWeight: 900 }}>{p.name || p.type || "Točka"}</div>
                  {p.type ? <div style={{ opacity: 0.75 }}>Tip: {p.type}</div> : null}
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    lat: {String(p.lat)} | lng: {String(p.lng)}
                  </div>
                  {p.notes ? <div style={{ marginTop: 6 }}>{p.notes}</div> : null}
                  {p.source ? <div style={{ marginTop: 6, opacity: 0.7 }}>Vir: {p.source}</div> : null}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
