// src/layout/Header.jsx
import React from "react";
import WorldSwitcher from "../components/WorldSwitcher";

function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        {/* Marca */}
        <div style={styles.brand}>
          <div style={styles.logoCircle}>
            <img
              src="/aurevi-logo.svg"
              alt="Logo AUREVI"
              style={styles.logoImg}
            />
          </div>

          <div style={styles.text}>
            <h1 style={styles.title}>AUREVI</h1>
            <p style={styles.subtitle}>Crea. Expresa. Evoluciona.</p>
          </div>
        </div>

        {/* Mundo */}
        <div style={styles.world}>
          <WorldSwitcher />
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background:
      "linear-gradient(180deg, rgba(5,7,15,0.85), rgba(5,7,15,0.65))",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },

  inner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background:
      "linear-gradient(135deg, #7c3aed, #ec4899)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  logoImg: {
    width: 24,
    height: 24,
  },

  text: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.1,
  },

  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.4,
    margin: 0,
    color: "#f9fafb",
  },

  subtitle: {
    fontSize: 12,
    margin: 0,
    color: "#9ca3af",
  },

  world: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
  },
};

export default Header;