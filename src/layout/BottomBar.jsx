import React from "react";
//import "./BottomBar.css";

function BottomBar({ currentScreen, navigate }) {
  const Item = ({ id, icon, label }) => {
    const active = currentScreen === id;
    return (
      <button
        type="button"
        className={`nav-item ${active ? "active" : ""}`}
        onClick={() => navigate(id)}
      >
        <span className="icon">{icon}</span>
        <span className="label">{label}</span>
      </button>
    );
  };

  return (
    <nav className="aurevi-bottombar">
      <Item id="home" icon="🏠" label="Inicio" />
      <Item id="explore" icon="🔍" label="Explorar" />
      <Item id="create" icon="➕" label="Crear" />
      <Item id="market" icon="🛒" label="Mercado" />
      <Item id="notifications" icon="🔔" label="Alertas" />
      <Item id="profile" icon="👤" label="Perfil" />

      {/* 🚫 OCULTOS TEMPORALMENTE */}
      {/*
      <Item id="wallet" icon="🪙" label="Monedas" />
      <Item id="messages" icon="💬" label="Mensajes" />
      */}
    </nav>
  );
}

export default BottomBar;