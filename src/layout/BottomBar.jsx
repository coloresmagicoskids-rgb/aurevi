// src/layout/BottomBar.jsx
import React from "react";
import "./BottomBar.css";

function BottomBar({ currentScreen, navigate }) {
  const baseBtn = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
    background: "transparent",
    color: "#e5e7eb",
    fontSize: 12,
    cursor: "pointer",
    minWidth: 60,
  };

  const activeBtn = {
    ...baseBtn,
    background:
      "linear-gradient(90deg, rgba(79,70,229,0.9), rgba(236,72,153,0.9))",
    border: "1px solid rgba(248,250,252,0.9)",
    color: "#f9fafb",
  };

  const iconStyle = { fontSize: 16 };

  return (
    <nav className="aurevi-bottom-bar">
      <button
        type="button"
        style={currentScreen === "home" ? activeBtn : baseBtn}
        onClick={() => navigate("home")}
      >
        <span style={iconStyle}>🏠</span>
        <span>Inicio</span>
      </button>

      <button
        type="button"
        style={currentScreen === "explore" ? activeBtn : baseBtn}
        onClick={() => navigate("explore")}
      >
        <span style={iconStyle}>🔍</span>
        <span>Explorar</span>
      </button>

      <button
        type="button"
        style={currentScreen === "create" ? activeBtn : baseBtn}
        onClick={() => navigate("create")}
      >
        <span style={iconStyle}>➕</span>
        <span>Crear</span>
      </button>

      <button
        type="button"
        style={currentScreen === "market" ? activeBtn : baseBtn}
        onClick={() => navigate("market")}
      >
        <span style={iconStyle}>🛒</span>
        <span>Mercado</span>
      </button>

      <button
        type="button"
        style={currentScreen === "wallet" ? activeBtn : baseBtn}
        onClick={() => navigate("wallet")}
      >
        <span style={iconStyle}>🪙</span>
        <span>Monedas</span>
      </button>

      <button
        type="button"
        style={currentScreen === "notifications" ? activeBtn : baseBtn}
        onClick={() => navigate("notifications")}
      >
       <span style={iconStyle}>🔔</span>
        <span>Alertas</span>
      </button>

      <button
        type="button"
        style={currentScreen === "messages" ? activeBtn : baseBtn}
        onClick={() => navigate("messages")}
      >
        <span style={iconStyle}>💬</span>
        <span>Mensajes</span>
      </button>

      <button
        type="button"
        style={currentScreen === "profile" ? activeBtn : baseBtn}
        onClick={() => navigate("profile")}
      >
        <span style={iconStyle}>👤</span>
        <span>Perfil</span>
      </button>
    </nav>
  );
}

export default BottomBar;