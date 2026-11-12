// src/RichTextEditor.jsx
import { useEffect, useRef, useState } from "react";

/* ================= SANITIZER ================= */

const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI", "H1", "H2", "H3", "H4", "SPAN", "BLOCKQUOTE",
]);

const DROP_TAGS = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "NOSCRIPT",
  "TEMPLATE", "SVG", "MATH", "FORM", "INPUT", "TEXTAREA", "BUTTON", "SELECT",
  "HEAD", "TITLE",
]);

const STYLE_RULES = {
  "font-size": /^(\d{1,3}(\.\d+)?(px|pt|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/i,
  "font-family": /^[\w\s,'"\-]+$/,
  "font-weight": /^(normal|bold|[1-9]00)$/i,
  "font-style": /^(normal|italic)$/i,
  "text-decoration": /^(none|underline|line-through|\s)+$/i,
  "text-decoration-line": /^(none|underline|line-through|\s)+$/i,
  "text-align": /^(left|right|center|justify)$/i,
  color: /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\))$/i,
};

function cleanStyle(str) {
  if (!str) return "";
  const out = [];
  for (const decl of String(str).split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).trim();
    const rule = STYLE_RULES[prop];
    if (rule && rule.test(val)) out.push(`${prop}: ${val}`);
  }
  return out.join("; ");
}

function walk(src, dest) {
  for (const node of Array.from(src.childNodes)) {
    if (node.nodeType === 3) {
      dest.appendChild(document.createTextNode(node.nodeValue));
      continue;
    }
    if (node.nodeType !== 1) continue;

    const tag = node.tagName;
    if (DROP_TAGS.has(tag)) continue;

    if (tag === "FONT") {
      const span = document.createElement("span");
      const parts = [];
      const face = node.getAttribute("face");
      const color = node.getAttribute("color");
      if (face && STYLE_RULES["font-family"].test(face)) parts.push(`font-family: ${face}`);
      if (color && STYLE_RULES.color.test(color)) parts.push(`color: ${color}`);
      if (parts.length) span.setAttribute("style", parts.join("; "));
      walk(node, span);
      dest.appendChild(span);
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      walk(node, dest);
      continue;
    }

    const el = document.createElement(tag.toLowerCase());
    const style = cleanStyle(node.getAttribute("style"));
    if (style) el.setAttribute("style", style);
    walk(node, el);
    dest.appendChild(el);
  }
}

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  const root = doc.body.firstChild;
  const out = document.createElement("div");
  if (root) walk(root, out);
  return out.innerHTML;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Stari zapisniki so shranjeni kot navadno besedilo, novi kot HTML.
export function toEditorHtml(value) {
  const v = String(value || "");
  if (!v) return "";
  if (!/<\/?[a-z][\s\S]*?>/i.test(v)) {
    return escapeHtml(v).replace(/\r?\n/g, "<br>");
  }
  return sanitizeHtml(v);
}

function isEditorEmpty(el) {
  return el.textContent.trim() === "" && !el.querySelector("ul,ol,li");
}

/* ================= EDITOR ================= */

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Začni pisati…",
  minHeight = 280,
}) {
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const [isEmpty, setIsEmpty] = useState(!value);
  const [active, setActive] = useState({});

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = toEditorHtml(value);
    setIsEmpty(isEditorEmpty(el));
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* ignore */
    }
    // samo ob prvem prikazu; naknadne spremembe vrednosti ne prepisujejo vnosa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onSel() {
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
      savedRange.current = sel.getRangeAt(0).cloneRange();
      try {
        setActive({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strike: document.queryCommandState("strikeThrough"),
          ul: document.queryCommandState("insertUnorderedList"),
          ol: document.queryCommandState("insertOrderedList"),
        });
      } catch {
        /* ignore */
      }
    }
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  function emit() {
    const el = editorRef.current;
    if (!el) return;
    const empty = isEditorEmpty(el);
    setIsEmpty(empty);
    onChange?.(empty ? "" : sanitizeHtml(el.innerHTML));
  }

  function restoreSel() {
    const el = editorRef.current;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }

  function exec(cmd, val = null) {
    restoreSel();
    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {
      /* ignore */
    }
    document.execCommand(cmd, false, val);
    emit();
  }

  function applySize(px) {
    restoreSel();
    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {
      /* ignore */
    }
    document.execCommand("fontSize", false, "7");
    const el = editorRef.current;
    el.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach((n) => {
      if (n.tagName === "FONT") {
        const span = document.createElement("span");
        span.style.fontSize = px + "px";
        while (n.firstChild) span.appendChild(n.firstChild);
        n.replaceWith(span);
      } else {
        n.style.fontSize = px + "px";
      }
    });
    emit();
  }

  function onPaste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html) document.execCommand("insertHTML", false, sanitizeHtml(html));
    else document.execCommand("insertText", false, text);
    emit();
  }

  return (
    <div
      style={{
        border: "1px solid rgba(107,78,46,.25)",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <style>{`
        .rte-content { position: relative; outline: none; padding: 12px 14px; line-height: 1.55; font-size: 14px; color: #2b2013; font-family: inherit; }
        .rte-content p, .rte-content div { margin: 0 0 8px; }
        .rte-content h1, .rte-content h2 { font-size: 20px; margin: 14px 0 6px; color: #6B4E2E; }
        .rte-content h3, .rte-content h4 { font-size: 16px; margin: 12px 0 6px; color: #6B4E2E; }
        .rte-content ul, .rte-content ol { margin: 4px 0 8px 22px; padding: 0; }
        .rte-content[data-empty="true"]::before { content: attr(data-placeholder); position: absolute; color: rgba(0,0,0,.35); pointer-events: none; }
      `}</style>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
          padding: 8,
          background: "rgba(107,78,46,.06)",
          borderBottom: "1px solid rgba(107,78,46,.15)",
        }}
      >
        <TB title="Razveljavi" onClick={() => exec("undo")}>↶</TB>
        <TB title="Uveljavi" onClick={() => exec("redo")}>↷</TB>
        <Divider />

        <select
          value=""
          onChange={(e) => e.target.value && exec("formatBlock", e.target.value)}
          style={selectStyle}
          title="Slog odstavka"
        >
          <option value="">Slog</option>
          <option value="<p>">Odstavek</option>
          <option value="<h2>">Naslov</option>
          <option value="<h3>">Podnaslov</option>
        </select>

        <select
          value=""
          onChange={(e) => e.target.value && exec("fontName", e.target.value)}
          style={selectStyle}
          title="Pisava"
        >
          <option value="">Pisava</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select
          value=""
          onChange={(e) => e.target.value && applySize(Number(e.target.value))}
          style={selectStyle}
          title="Velikost pisave"
        >
          <option value="">Velikost</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s} px</option>
          ))}
        </select>
        <Divider />

        <TB title="Krepko (Ctrl+B)" active={active.bold} onClick={() => exec("bold")}>
          <b>B</b>
        </TB>
        <TB title="Ležeče (Ctrl+I)" active={active.italic} onClick={() => exec("italic")}>
          <i>I</i>
        </TB>
        <TB title="Podčrtano (Ctrl+U)" active={active.underline} onClick={() => exec("underline")}>
          <u>U</u>
        </TB>
        <TB title="Prečrtano" active={active.strike} onClick={() => exec("strikeThrough")}>
          <s>S</s>
        </TB>
        <Divider />

        <TB title="Alineje" active={active.ul} onClick={() => exec("insertUnorderedList")}>
          • Seznam
        </TB>
        <TB title="Oštevilčen seznam" active={active.ol} onClick={() => exec("insertOrderedList")}>
          1. Seznam
        </TB>
        <Divider />

        <TB title="Poravnaj levo" onClick={() => exec("justifyLeft")}>Levo</TB>
        <TB title="Poravnaj na sredino" onClick={() => exec("justifyCenter")}>Sredina</TB>
        <TB title="Poravnaj desno" onClick={() => exec("justifyRight")}>Desno</TB>
        <TB title="Obojestransko" onClick={() => exec("justifyFull")}>Blok</TB>
        <Divider />

        <TB title="Počisti oblikovanje" onClick={() => exec("removeFormat")}>Počisti</TB>
      </div>

      <div
        ref={editorRef}
        className="rte-content"
        contentEditable
        spellCheck
        lang="sl"
        data-empty={isEmpty ? "true" : "false"}
        data-placeholder={placeholder}
        onInput={emit}
        onPaste={onPaste}
        style={{ minHeight, maxHeight: "62vh", overflowY: "auto" }}
      />
    </div>
  );
}

const selectStyle = {
  border: "1px solid rgba(107,78,46,.25)",
  background: "#fff",
  borderRadius: 8,
  padding: "4px 6px",
  fontSize: 12,
  color: "#6B4E2E",
  cursor: "pointer",
};

function TB({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        border: "1px solid " + (active ? "#6B4E2E" : "rgba(107,78,46,.25)"),
        background: active ? "rgba(107,78,46,.18)" : "#fff",
        color: "#6B4E2E",
        borderRadius: 8,
        padding: "4px 9px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        minWidth: 28,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        alignSelf: "stretch",
        background: "rgba(107,78,46,.2)",
        margin: "0 4px",
      }}
    />
  );
}