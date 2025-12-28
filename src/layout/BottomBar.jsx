// src/layout/BottomBar.jsx
import React, { useMemo } from "react";
import "./BottomBar.css";

function BottomBar({ currentScreen, navigate }) {
  const iconStyle = useMemo(() => ({ fontSize: 16, lineHeight: "16px" }), []);

  const baseBtn = {
    flex: 1,            // ✅ clave: todos ocupan el mismo ancho
    minWidth: 0,        // ✅ clave: permite encogerse sin desbordar
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "8px 0",   // ✅ menos padding lateral para que quepa
    borderRadius: 16,
    border: "1px solid transparent",
    background: "transparent",
    color: "#e5e7eb",
    fontSize: 12,
    cursor: "pointer",
    overflow: "hidden",
  };

  const activeBtn = {
    ...baseBtn,
    background:
      "linear-gradient(90deg, rgba(79,70,229,0.9), rgba(236,72,153,0.9))",
    border: "1px solid rgba(248,250,252,0.9)",
    color: "#f9fafb",
  };

  const items = [
    { key: "home", icon: "🏠", label: "Inicio" },
    { key: "explore", icon: "🔍", label: "Explorar" },
    { key: "create", icon: "➕", label: "Crear" },
    { key: "market", icon: "🛒", label: "Mercado" },
    { key: "wallet", icon: "🪙", label: "Monedas" },
    { key: "notifications", icon: "🔔", label: "Alertas" },
    { key: "messages", icon: "💬", label: "Mensajes" },
    { key: "profile", icon: "👤", label: "Perfil" },
  ];

  return (
    <nav className="aurevi-bottom-bar" role="navigation" aria-label="AUREVI">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className="aurevi-bottom-item"
          style={currentScreen === it.key ? activeBtn : baseBtn}
          onClick={() => navigate(it.key)}
          aria-current={currentScreen === it.key ? "page" : undefined}
          title={it.label}
        >
          <span style={iconStyle}>{it.icon}</span>
          <span className="label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {it.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

export default BottomBar;