// src/layout/Header.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import WorldSwitcher from "../components/WorldSwitcher";
import { useWorld } from "../worlds/WorldContext";
import { WORLD_LABELS } from "../worlds/worldTypes";

function WorldPinModal({ open, targetWorld, onClose, onSubmit }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setPin("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const label = WORLD_LABELS?.[targetWorld] || String(targetWorld);

  const handleSubmit = () => {
    const res = onSubmit?.(pin);
    if (res?.ok) {
      setPin("");
      setErr("");
      return;
    }
    setErr(res?.error === "BAD_PIN" ? "PIN incorrecto." : "No se pudo validar.");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Acceso protegido"
      style={modalStyles.backdrop}
      onMouseDown={onClose}
    >
      <div style={modalStyles.card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={modalStyles.title}>Acceso protegido</div>
        <div style={modalStyles.subtitle}>
          Para entrar a <strong>{label}</strong>, escribe el PIN.
        </div>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          type="password"
          placeholder="PIN"
          style={modalStyles.input}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
        />

        {err && <div style={modalStyles.error}>{err}</div>}

        <div style={modalStyles.actions}>
          <button type="button" onClick={onClose} style={modalStyles.btnGhost}>
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} style={modalStyles.btnPrimary}>
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ currentScreen = "home", navigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef(null);

  // ✅ Gate de permisos (PIN/roles) desde WorldContext
  const { worldGate, submitWorldPin, closeWorldGate } = useWorld();

  const items = useMemo(
    () => [
      { id: "home", icon: "🏠", label: "Inicio" },
      { id: "explore", icon: "🔍", label: "Explorar" },
      { id: "create", icon: "➕", label: "Crear" },
      { id: "album", icon: "📷", label: "Álbum" },
      { id: "market", icon: "🛒", label: "Mercado" },
      { id: "notifications", icon: "🔔", label: "Alertas" },
      { id: "profile", icon: "👤", label: "Perfil" },
    ],
    []
  );

  const go = (id) => {
    if (typeof navigate === "function") navigate(id);
    setMenuOpen(false);
  };

  // ✅ Cerrar menú: click fuera + Escape
  useEffect(() => {
    if (!menuOpen) return;

    const onDown = (e) => {
      if (!menuWrapRef.current) return;
      if (!menuWrapRef.current.contains(e.target)) setMenuOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header style={styles.header}>
      {/* Fila principal */}
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

        {/* Acciones derecha */}
        <div style={styles.right} ref={menuWrapRef}>
          {/* Botón menú (☰) */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={styles.menuBtn}
            aria-label="Abrir menú"
            aria-expanded={menuOpen ? "true" : "false"}
            aria-haspopup="menu"
            title="Menú"
          >
            <span style={styles.menuIcon} aria-hidden="true">
              ☰
            </span>
          </button>

          {/* Dropdown del menú */}
          {menuOpen && (
            <div style={styles.dropdown} role="menu" aria-label="Menú AUREVI">
              {/* ✅ WorldSwitcher embebido: SIN trigger, y cierra el menú al elegir */}
              <WorldSwitcher
                showTrigger={false}
                onPicked={() => setMenuOpen(false)}
              />

              <div style={styles.dropdownHint}>
                Consejo: aquí luego podemos agregar “Mensajes”, “Monedas”, “Ajustes”, etc.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra superior de iconos (debajo del header) */}
      <div style={styles.topNavWrap}>
        <div style={styles.topNav}>
          {items.map((it) => {
            const active = currentScreen === it.id;

            return (
              <button
                key={it.id}
                type="button"
                onClick={() => go(it.id)}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : null),
                }}
                aria-current={active ? "page" : undefined}
              >
                <span style={styles.navIcon} aria-hidden="true">
                  {it.icon}
                </span>
                <span style={styles.navLabel}>{it.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ✅ Modal de PIN/Permisos por mundo */}
      <WorldPinModal
        open={!!worldGate?.open}
        targetWorld={worldGate?.targetWorld}
        onClose={closeWorldGate}
        onSubmit={submitWorldPin}
      />
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 2000, // ✅ alto para que el dropdown quede encima
    background: "linear-gradient(180deg, rgba(5,7,15,0.92), rgba(5,7,15,0.72))",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },

  inner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "14px 20px 10px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    position: "relative",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 200,
  },

  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7c3aed, #ec4899)",
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

  right: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    position: "relative",
    zIndex: 2100,
  },

  menuBtn: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(18,18,22,0.55)",
    color: "#fff",
    borderRadius: 12,
    padding: "10px 12px",
    cursor: "pointer",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
  },

  menuIcon: {
    fontSize: 16,
    lineHeight: 1,
  },

  dropdown: {
    position: "absolute",
    top: 52,
    right: 0,
    width: 320,
    maxWidth: "86vw",
    borderRadius: 16,
    background: "rgba(18, 18, 22, 0.92)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    backdropFilter: "blur(12px)",
    padding: 12,
    zIndex: 2200,
  },

  dropdownHint: {
    marginTop: 10,
    fontSize: 11,
    color: "rgba(156,163,175,0.85)",
  },

  // Barra de iconos debajo del header
  topNavWrap: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "10px 20px 14px",
  },

  topNav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 18,
    background: "rgba(18, 18, 22, 0.60)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
  },

  navItem: {
    flex: "0 0 auto",
    minWidth: 86,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid transparent",
    background: "transparent",
    color: "rgba(255,255,255,0.78)",
    cursor: "pointer",
    userSelect: "none",
  },

  navItemActive: {
    color: "#fff",
    background: "linear-gradient(135deg, rgba(255,0,122,0.28), rgba(122,0,255,0.22))",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  navIcon: {
    fontSize: 18,
    lineHeight: 1,
  },

  navLabel: {
    fontSize: 12,
    lineHeight: 1,
    opacity: 0.9,
  },
};

const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "grid",
    placeItems: "center",
    zIndex: 99999,
    padding: 14,
  },
  card: {
    width: "min(420px, 92vw)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(10,12,20,0.95)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
  },
  title: { fontWeight: 900, color: "#fff", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "rgba(229,231,235,0.85)", marginBottom: 10 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    outline: "none",
  },
  error: { marginTop: 8, color: "#fca5a5", fontSize: 12 },
  actions: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(135deg, rgba(255,0,122,0.35), rgba(122,0,255,0.30))",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
};

export default Header;