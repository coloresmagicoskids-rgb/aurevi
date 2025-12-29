// src/layout/BottomBar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const scrollRef = useRef(null);
  const itemRefs = useRef({});

  const [bubble, setBubble] = useState({ left: 4, width: 60 });

  const activeIndex = Math.max(0, items.findIndex((x) => x.id === currentScreen));

  // Calcula posición/tamaño de la burbuja según el botón activo
  const recalcBubble = () => {
    const container = scrollRef.current;
    const btn = itemRefs.current[currentScreen];
    if (!container || !btn) return;

    // offsetLeft es relativo al contenido scrolleable (perfecto)
    const left = btn.offsetLeft + 4;
    const width = btn.offsetWidth - 8;

    setBubble({ left, width });

    // opcional: si el item activo queda fuera de vista, lo centra
    const cLeft = container.scrollLeft;
    const cRight = cLeft + container.clientWidth;
    const bLeft = btn.offsetLeft;
    const bRight = bLeft + btn.offsetWidth;

    if (bLeft < cLeft + 12 || bRight > cRight - 12) {
      container.scrollTo({
        left: bLeft - container.clientWidth / 2 + btn.offsetWidth / 2,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    // espera a que pinte layout
    const id = requestAnimationFrame(recalcBubble);
    window.addEventListener("resize", recalcBubble);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", recalcBubble);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen, items.length]);

  const Item = ({ id, icon, label }) => {
    const active = currentScreen === id;
    return (
      <button
        ref={(el) => {
          if (el) itemRefs.current[id] = el;
        }}
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
      <div className="aurevi-bottombar-inner">
        {/* ✅ Scroll horizontal REAL solo dentro de la barra */}
        <div className="aurevi-bottombar-scroll" ref={scrollRef}>
          {/* Burbuja que se desliza (en px, funciona con scroll) */}
          <span
            className="active-bubble"
            style={{
              left: `${bubble.left}px`,
              width: `${bubble.width}px`,
            }}
            aria-hidden="true"
          />

          {items.map((it) => (
            <Item key={it.id} id={it.id} icon={it.icon} label={it.label} />
          ))}
        </div>
      </div>
    </nav>
  );
}

export default BottomBar;