// src/layout/Header.jsx
import React from "react";
import WorldSwitcher from "../components/WorldSwitcher";

function Header() {
  return (
    <header className="aurevi-header">
      <div className="aurevi-header-inner">
        {/* Bloque de marca: logo + texto */}
        <div className="aurevi-header-brand">
          <div className="aurevi-logo-circle">
            <img
              src="/aurevi-logo.svg"
              alt="Logo AUREVI"
              className="aurevi-logo-img"
            />
          </div>

          <div className="aurevi-header-text">
            <h1 className="aurevi-title">AUREVI</h1>
            <p className="aurevi-subtitle">Crea. Expresa. Evoluciona.</p>
          </div>
        </div>

        {/* Selector de mundos */}
        <div style={{ marginLeft: "auto" }}>
          <WorldSwitcher />
        </div>
      </div>
    </header>
  );
}

export default Header;