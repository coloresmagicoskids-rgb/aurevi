// src/layout/BottomBar.jsx
import React, { useMemo } from "react";
import "./BottomBar.css";

function BottomBar({ currentScreen, navigate }) {
  const items = useMemo(
    () => [
      { id: "home", icon: "🏠", label: "Inicio" },
      { id: "explore", icon: "🔍", label: "Explorar" },
      { id: "create", icon: "➕", label: "Crear" },
      { id: "market", icon: "🛒", label: "Mercado" },

      // Ocultos temporalmente
      // { id: "wallet", icon: "🪙", label: "Monedas" },

      { id: "notifications", icon: "🔔", label: "Alertas" },

      // Ocultos temporalmente
      // { id: "messages", icon: "💬", label: "Mensajes" },

      { id: "profile", icon: "👤", label: "Perfil" },
    ],
    []
  );

  const activeIndex = Math.max(
    0,
    items.findIndex((x) => x.id === currentScreen)
  );

  const Item = ({ id, icon, label }) => {
    const active = currentScreen === id;
    return (
      <button
        type="button"
        className={`nav-item ${active ? "active" : ""}`}
        onClick={() => navigate(id)}
      >
        <span className="icon" aria-hidden="true">
          {icon}
        </span>
        <span className="label">{label}</span>
      </button>
    );
  };

  return (
    <nav className="aurevi-bottombar" role="navigation" aria-label="Barra inferior">
      {/* Capa interna para burbuja + items */}
      <div className="aurevi-bottombar-inner">
        {/* Burbuja que se desliza */}
        <span
          className="active-bubble"
          style={{ "--active-index": activeIndex, "--items": items.length }}
          aria-hidden="true"
        />

        {items.map((it) => (
          <Item key={it.id} id={it.id} icon={it.icon} label={it.label} />
        ))}
      </div>
    </nav>
  );
}

export default BottomBar;