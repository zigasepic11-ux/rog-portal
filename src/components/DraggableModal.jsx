// src/components/DraggableModal.jsx
import { useEffect, useRef, useState } from "react";

export function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, display: "block", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function Modal({ title, onClose, children, width = 520 }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onMove(e) {
      const d = drag.current;
      if (!d.dragging) return;
      setPos({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
    }
    function onUp() {
      drag.current.dragging = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function onDragStart(e) {
    drag.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fdfaf3",
          borderRadius: 16,
          padding: 24,
          width: `min(${width}px, 100%)`,
          maxHeight: "94vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(60,40,20,.35), 0 0 0 1px rgba(107,78,46,.18)",
          animation: "boardPopIn .18s ease",
          pointerEvents: "auto",
          transform: `translate(${pos.x}px, ${pos.y}px)`,
        }}
      >
        <div
          onMouseDown={onDragStart}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
            cursor: "grab",
            userSelect: "none",
          }}
        >
          <h3 style={{ margin: 0, color: "#6B4E2E", fontSize: 18 }}>{title}</h3>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Zapri"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              color: "#6B4E2E",
              opacity: 0.6,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        <div onMouseDown={(e) => e.stopPropagation()}>{children}</div>
        <style>{`
          @keyframes boardPopIn { from { opacity: 0; transform: scale(.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}