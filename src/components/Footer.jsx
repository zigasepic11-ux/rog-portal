// src/components/Footer.jsx
import "./Footer.css";

export default function Footer({ onNavigate }) {
  return (
    <div className="bottom-bar">
      <span>© 2026 ROG</span>
      <span className="footer-divider">•</span>
      <span className="footer-link" onClick={() => onNavigate("terms")}>
        Pogoji uporabe
      </span>
      <span className="footer-divider">•</span>
      <span className="footer-link" onClick={() => onNavigate("privacy")}>
        Zasebnost
      </span>
    </div>
  );
}