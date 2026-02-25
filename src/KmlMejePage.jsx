// src/KmlMejePage.jsx
import { useEffect, useMemo, useState } from "react";
import BoundaryMap from "./components/BoundaryMap";
import PointsImport from "./PointsImport.jsx";

function toSlug(ldIdOrSlug) {
  if (!ldIdOrSlug) return null;
  const s = String(ldIdOrSlug).trim();
  return s.startsWith("ld_") ? s : `ld_${s}`;
}

export default function KmlMejePage({ dash, me }) {
  const [manifest, setManifest] = useState(null);
  const [err, setErr] = useState("");

  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isSuper = useMemo(() => String(me?.role || "") === "super", [me?.role]);

  const ldId = useMemo(() => String(dash?.ldId || "").trim(), [dash?.ldId]);
  const ldSlug = useMemo(() => toSlug(dash?.ldId), [dash?.ldId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr("");
        const res = await fetch("/boundaries/manifest.json", { cache: "no-store" });
        if (!res.ok) throw new Error("Meje lovišča niso na voljo.");
        const json = await res.json();
        if (!cancelled) setManifest(Array.isArray(json) ? json : []);
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hit = useMemo(() => {
    if (!manifest || !ldSlug) return null;
    return manifest.find((m) => m?.slug === ldSlug) || null;
  }, [manifest, ldSlug]);

  const geoJsonUrl = hit?.geojsonUrl || null;

  // ✅ key naj vključuje ldId + refreshKey, da se BoundaryMap remounta ob switch-ld in importu
  const mapKey = useMemo(() => `${ldId || "no-ld"}__${refreshKey}`, [ldId, refreshKey]);

  return (
    <div>
      <div className="stat" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h4>Meje lovišča</h4>

            <div className="desc">
              {dash?.ldName ? (
                <>
                  Trenutno: <b>{dash.ldName}</b>
                </>
              ) : (
                <>Nalagam lovišče…</>
              )}
            </div>
          </div>

          {isSuper ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="btn-mini" onClick={() => setShowImport(true)}>
                Uvozi točke
              </button>
            </div>
          ) : null}
        </div>

        {err && (
          <div className="error" style={{ marginTop: 10 }}>
            {err}
          </div>
        )}
      </div>

      {geoJsonUrl ? (
        <BoundaryMap
          key={mapKey}
          geoJsonUrl={geoJsonUrl}
          ldId={ldId}
          reloadKey={refreshKey}
        />
      ) : (
        !err && (
          <div className="stat">
            <h4>Meja ni prikazana</h4>
            <div className="desc">Za to lovišče meje trenutno niso na voljo.</div>
          </div>
        )
      )}

      <PointsImport
        open={showImport}
        onClose={() => setShowImport(false)}
        onDone={() => {
          // trigger reload points (BoundaryMap remount)
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
