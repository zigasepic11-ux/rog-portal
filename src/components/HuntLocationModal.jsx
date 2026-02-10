// src/components/HuntLocationModal.jsx
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { getPoiIcon } from "./poiIcons";

function stop(e) {
  e.preventDefault();
  e.stopPropagation();
}

function toSlug(ldIdOrSlug) {
  if (!ldIdOrSlug) return null;
  const s = String(ldIdOrSlug).trim();
  return s.startsWith("ld_") ? s : `ld_${s}`;
}

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") + "/";

function toNum(v) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickCenter(hunt) {
  const mode = String(hunt?.locationMode || "private_text");

  if (mode === "poi") {
    const lat = toNum(hunt?.lat);
    const lng = toNum(hunt?.lng);
    if (lat != null && lng != null) return { lat, lng, mode };
    return null;
  }

  if (mode === "approx") {
    const lat = toNum(hunt?.approxLat);
    const lng = toNum(hunt?.approxLng);
    if (lat != null && lng != null) return { lat, lng, mode };

    // fallback če so approx polja manjkala, ampak ima lat/lng
    const lat2 = toNum(hunt?.lat);
    const lng2 = toNum(hunt?.lng);
    if (lat2 != null && lng2 != null) return { lat: lat2, lng: lng2, mode };
    return null;
  }

  return null;
}

function FitTo({ boundary, center }) {
  const map = useMap();

  useEffect(() => {
    if (boundary) {
      try {
        const layer = L.geoJSON(boundary);
        const b = layer.getBounds();
        if (b && b.isValid()) {
          map.fitBounds(b, { padding: [22, 22] });
          return;
        }
      } catch {
        // ignore
      }
    }

    if (center) {
      map.setView([center.lat, center.lng], center.mode === "approx" ? 12 : 14);
    }
  }, [boundary, center, map]);

  return null;
}

export default function HuntLocationModal({ open, onClose, hunt }) {
  const safeHunt = hunt || {};

  const mode = useMemo(() => String(safeHunt.locationMode || "private_text"), [safeHunt.locationMode]);
  const center = useMemo(() => pickCenter(safeHunt), [safeHunt]);

  const ldId = useMemo(() => (safeHunt.ldId ? String(safeHunt.ldId) : ""), [safeHunt.ldId]);
  const slug = useMemo(() => toSlug(ldId), [ldId]);

  const [boundary, setBoundary] = useState(null);
  const [bErr, setBErr] = useState("");

  // ✅ Debug info (skrito privzeto)
  const DEBUG = String(import.meta?.env?.VITE_DEBUG || "").trim() === "1";

  const [dbg, setDbg] = useState({
    ldId: "",
    slug: "",
    manifestUrl: "",
    geoJsonUrl: "",
  });

  useEffect(() => {
    function onKey(e) {
      if (!open) return;
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setBoundary(null);
        setBErr("");

        if (!open) return;

        const manifestUrl = `${BASE}boundaries/manifest.json`;
        const s = slug;

        // dbg hranimo, a prikazujemo samo če je DEBUG
        setDbg({
          ldId: ldId || "",
          slug: s || "",
          manifestUrl,
          geoJsonUrl: "",
        });

        if (!s) return;

        const mRes = await fetch(manifestUrl, { cache: "no-store" });
        if (!mRes.ok) throw new Error(`Ne najdem manifest: ${manifestUrl} (HTTP ${mRes.status})`);

        const manifest = await mRes.json();
        const hit = Array.isArray(manifest) ? manifest.find((x) => x.slug === s) : null;

        const rel = hit?.geojsonUrl || "";
        const geoJsonUrl = rel
          ? rel.startsWith("/")
            ? `${BASE}${rel.slice(1)}`
            : `${BASE}${rel}`
          : "";

        setDbg((d) => ({ ...d, geoJsonUrl }));

        if (!geoJsonUrl) return;

        const gRes = await fetch(geoJsonUrl, { cache: "no-store" });
        if (!gRes.ok) throw new Error(`Ne morem naložiti meje: ${geoJsonUrl} (HTTP ${gRes.status})`);

        const geo = await gRes.json();
        if (!cancelled) setBoundary(geo);
      } catch (e) {
        if (!cancelled) setBErr(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, slug, ldId]);

  if (!open) return null;

  const radiusM = toNum(safeHunt.approxRadiusM) ?? 1000;

  const title = safeHunt.hunterName ? `Lokacija – ${safeHunt.hunterName}` : "Lokacija lova";

  const when =
    safeHunt.startedAt
      ? new Date(safeHunt.startedAt).toLocaleString()
      : safeHunt.finishedAt
      ? new Date(safeHunt.finishedAt).toLocaleString()
      : "";

  const labelLine =
    mode === "poi"
      ? safeHunt.poiName || safeHunt.locationName || "POI"
      : mode === "approx"
      ? safeHunt.locationName || "Približna lokacija"
      : safeHunt.locationName || "";

  const poiType = mode === "poi" ? (safeHunt.poiType || "drugo") : null;
  const poiIcon = poiType ? getPoiIcon(poiType) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onClick={stop}
        style={{
          width: "min(1100px, 96vw)",
          height: "min(760px, 92vh)",
          background: "rgba(255,255,255,0.94)",
          borderRadius: 18,
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
          border: "1px solid rgba(107,78,46,.25)",
          backdropFilter: "blur(8px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(107,78,46,.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 900, color: "#6B4E2E" }}>{title}</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              {when}
              {labelLine ? ` • ${labelLine}` : ""}
              {ldId ? ` • ${ldId}` : ""}
            </div>

            {/* ✅ Debug izpis skrit (vključiš z VITE_DEBUG=1) */}
            {DEBUG ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                slug: <code>{dbg.slug || "—"}</code> • manifest: <code>{dbg.manifestUrl || "—"}</code> • geojson:{" "}
                <code>{dbg.geoJsonUrl || "—"}</code>
              </div>
            ) : null}

            {bErr ? (
              <div style={{ marginTop: 6, color: "#B42318", fontWeight: 800, fontSize: 12 }}>
                Meja: {bErr}
              </div>
            ) : null}
          </div>

          <button className="btn-mini" onClick={onClose} style={{ height: 38, padding: "0 12px" }}>
            Zapri
          </button>
        </div>

        <div style={{ flex: 1, position: "relative" }}>
          {mode === "private_text" || !center ? (
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Lokacija ni prikazana</div>
              <div style={{ opacity: 0.8 }}>
                Ta lov ima način lokacije <code>PRIVATE_TEXT</code> ali nima koordinat.
              </div>
            </div>
          ) : (
            <MapContainer
              style={{ height: "100%", width: "100%" }}
              center={[center.lat, center.lng]}
              zoom={13}
              scrollWheelZoom
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />

              {boundary ? <GeoJSON data={boundary} style={{ weight: 5, fillOpacity: 0.10 }} /> : null}

              {mode === "poi" && poiIcon ? (
                <Marker position={[center.lat, center.lng]} icon={poiIcon}>
                  <Popup>
                    <div style={{ fontWeight: 900 }}>{safeHunt.hunterName || "Lovec"}</div>
                    <div style={{ opacity: 0.75 }}>POI (točka)</div>
                    {safeHunt.poiType ? (
                      <div style={{ marginTop: 6 }}>
                        Tip: <b>{safeHunt.poiType}</b>
                      </div>
                    ) : null}
                    {labelLine ? <div style={{ marginTop: 6 }}>{labelLine}</div> : null}
                  </Popup>
                </Marker>
              ) : null}

              {mode === "approx" ? (
                <Circle center={[center.lat, center.lng]} radius={radiusM} pathOptions={{ weight: 2, fillOpacity: 0.18 }} />
              ) : null}

              <FitTo boundary={boundary} center={center} />
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}
