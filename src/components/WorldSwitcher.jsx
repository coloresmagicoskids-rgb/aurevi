// src/components/WorldSwitcher.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorld } from "../worlds/WorldContext";
import { WORLD_TYPES, WORLD_LABELS } from "../worlds/worldTypes";

// 🎨 Identidad visual por mundo (icono + color)
const WORLD_META = {
  publico: { icon: "🌐", accent: "rgba(56,189,248,0.35)" },       // cyan
  creadores: { icon: "🎬", accent: "rgba(236,72,153,0.35)" },    // pink
  infantil: { icon: "🧒", accent: "rgba(250,204,21,0.35)" },     // yellow
  bienestar: { icon: "🧘", accent: "rgba(34,197,94,0.35)" },     // green
  experimental: { icon: "🧪", accent: "rgba(167,139,250,0.35)" } // violet
};

export default function WorldSwitcher({
  showTrigger = true,
  onPicked,
  remember = false, // listo para el paso de localStorage
}) {
  const { activeWorld, setActiveWorld } = useWorld();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // para animar salida sin cortar
  const wrapRef = useRef(null);

  const worlds = useMemo(() => Object.values(WORLD_TYPES || {}), []);
  const labelOf = (w) => WORLD_LABELS?.[w] || String(w);

  const metaOf = (w) =>
    WORLD_META?.[String(w).toLowerCase()] || {
      icon: "🟣",
      accent: "rgba(99,102,241,0.28)",
    };

  // ✅ Modo embebido: si NO hay trigger, debe verse SIEMPRE (open permanente)
  const embedded = !showTrigger;
  const isOpen = embedded ? true : open;
  const isMounted = embedded ? true : mounted;

  // ✅ Montaje/Desmontaje animado (solo cuando hay trigger)
  useEffect(() => {
    if (embedded) return;

    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 170);
    return () => clearTimeout(t);
  }, [open, embedded]);

  // ✅ Cerrar al click fuera / escape (solo cuando hay trigger)
  useEffect(() => {
    if (embedded) return;

    const onDown = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [embedded]);

  const pick = (w) => {
    setActiveWorld(w);

    if (remember) {
      try {
        localStorage.setItem("aurevi_active_world", String(w));
      } catch {}
    }

    if (!embedded) setOpen(false);
    onPicked?.(w);
  };

  const activeMeta = metaOf(activeWorld);

  return (
    <div ref={wrapRef} style={styles.wrap}>
      {/* ✅ Disparador opcional */}
      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={styles.menuBtn}
          aria-haspopup="menu"
          aria-expanded={isOpen ? "true" : "false"}
          aria-label="Mundos"
          title="Mundos"
        >
          <span style={styles.bars} aria-hidden="true">
            ☰
          </span>
        </button>
      )}

      {/* ✅ Dropdown (modo trigger) / panel embebido (sin trigger) */}
      {isMounted && (
        <div
          style={{
            ...styles.dropdown,
            ...(embedded ? styles.dropdownEmbedded : null),
            ...(isOpen ? styles.dropdownOpen : styles.dropdownClosed),
          }}
          role="menu"
          aria-label="Mundos"
        >
          <div style={styles.head}>
            <div style={styles.title}>MUNDO</div>

            {/* ✅ Chip del mundo activo con color + icono */}
            <div
              style={{
                ...styles.activeChip,
                border: "1px solid rgba(255,255,255,0.14)",
                background: `linear-gradient(135deg, ${activeMeta.accent}, rgba(255,255,255,0.06))`,
              }}
              title={`Mundo activo: ${labelOf(activeWorld)}`}
            >
              <span style={{ marginRight: 8 }} aria-hidden="true">
                {activeMeta.icon}
              </span>
              <span>{labelOf(activeWorld)}</span>
            </div>
          </div>

          <div style={styles.list}>
            {worlds.map((w) => {
              const active = w === activeWorld;
              const meta = metaOf(w);

              return (
                <button
                  key={String(w)}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active ? "true" : "false"}
                  onClick={() => pick(w)}
                  style={{
                    ...styles.item,
                    ...(active
                      ? {
                          ...styles.itemActive,
                          background: `linear-gradient(135deg, ${meta.accent}, rgba(122,0,255,0.12))`,
                        }
                      : null),
                  }}
                >
                  <span style={styles.itemRow}>
                    <span style={styles.itemLeft}>
                      <span style={styles.itemIcon} aria-hidden="true">
                        {meta.icon}
                      </span>
                      <span>{labelOf(w)}</span>
                    </span>

                    {active && <span style={styles.activeDot} aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },

  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,12,20,0.55)",
    color: "#e5e7eb",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },

  bars: {
    fontSize: 20,
    lineHeight: 1,
    transform: "translateY(-1px)",
  },

  dropdown: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    zIndex: 9999,
    width: 320,
    maxWidth: "86vw",
    padding: 12,
    borderRadius: 16,
    background: "rgba(10,12,20,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 45px rgba(0,0,0,0.55)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",

    transformOrigin: "top right",
    transition: "opacity 160ms ease, transform 170ms ease",
    willChange: "opacity, transform",
  },

  // ✅ Cuando está embebido en el menú del Header:
  // - no debe flotar absoluto ni animar entrada/salida
  dropdownEmbedded: {
    position: "relative",
    top: "auto",
    right: "auto",
    width: "100%",
    maxWidth: "100%",
    boxShadow: "none",
    transform: "none",
    transition: "none",
  },

  dropdownOpen: {
    opacity: 1,
    transform: "translateY(0) scale(1)",
    pointerEvents: "auto",
  },

  dropdownClosed: {
    opacity: 0,
    transform: "translateY(-6px) scale(0.99)",
    pointerEvents: "none",
  },

  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  title: {
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: 900,
    color: "rgba(255,255,255,0.85)",
  },

  activeChip: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    color: "#e5e7eb",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  item: {
    width: "100%",
    textAlign: "left",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.88)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 750,
  },

  itemActive: {
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff",
  },

  itemRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  itemLeft: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  },

  itemIcon: {
    fontSize: 16,
    lineHeight: 1,
    width: 22,
    textAlign: "center",
  },

  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.95)",
    boxShadow: "0 0 0 3px rgba(255,255,255,0.10)",
    flexShrink: 0,
  },
};