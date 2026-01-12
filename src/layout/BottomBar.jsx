// src/layout/BottomBar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./BottomBar.css";

/**
 * ✅ Top navigation bar behavior (YouTube-like, but on TOP):
 * - sticky under Header (CSS handles sticky position)
 * - reserves space via CSS var --aurevi-topbar-h (so content doesn't hide behind)
 * - auto-hide on scroll down / show on scroll up
 * - compact mode reduces height
 */
function BottomBar({
  currentScreen,
  navigate,
  compact = false,
  autoHide = true,
}) {
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

  const scrollRef = useRef(null);
  const itemRefs = useRef({});
  const navRef = useRef(null);

  const [bubble, setBubble] = useState({ left: 4, width: 60 });

  // ✅ auto-hide state
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const activeIndex = Math.max(
    0,
    items.findIndex((x) => x.id === currentScreen)
  );

  // ----------------------------------------------------
  // ✅ Reserve space in layout (TOP padding)
  // We set: --aurevi-topbar-h
  // Then .aurevi-main should use padding-top: var(--aurevi-topbar-h)
  // ----------------------------------------------------
  const applyTopBarHeightVar = () => {
    const el = navRef.current;
    if (!el) return;
    const h = el.offsetHeight || 64;
    document.documentElement.style.setProperty("--aurevi-topbar-h", `${h}px`);
  };

  useEffect(() => {
    applyTopBarHeightVar();
    window.addEventListener("resize", applyTopBarHeightVar);
    return () => window.removeEventListener("resize", applyTopBarHeightVar);
  }, [compact]);

  // ----------------------------------------------------
  // ✅ Bubble position
  // ----------------------------------------------------
  const recalcBubble = () => {
    const container = scrollRef.current;
    const btn = itemRefs.current[currentScreen];
    const fallbackBtn =
      activeIndex >= 0 ? itemRefs.current[items[activeIndex]?.id] : null;
    const targetBtn = btn || fallbackBtn;

    if (!container || !targetBtn) return;

    const left = targetBtn.offsetLeft + 4;
    const width = targetBtn.offsetWidth - 8;

    setBubble({ left, width });

    // Keep active item visible in horizontal scroll
    const cLeft = container.scrollLeft;
    const cRight = cLeft + container.clientWidth;
    const bLeft = targetBtn.offsetLeft;
    const bRight = bLeft + targetBtn.offsetWidth;

    if (bLeft < cLeft + 12 || bRight > cRight - 12) {
      container.scrollTo({
        left: bLeft - container.clientWidth / 2 + targetBtn.offsetWidth / 2,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const id = requestAnimationFrame(recalcBubble);
    window.addEventListener("resize", recalcBubble);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", recalcBubble);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen, items.length]);

  // ----------------------------------------------------
  // ✅ Auto-hide on scroll (YouTube feel)
  // - hide when scrolling down
  // - show when scrolling up
  // - do not hide near top
  // ----------------------------------------------------
  useEffect(() => {
    if (!autoHide) return;

    lastScrollY.current = window.scrollY || 0;

    const onScroll = () => {
      const y = window.scrollY || 0;

      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const prev = lastScrollY.current;
        const delta = y - prev;

        // Don’t hide near top
        if (y < 40) {
          setHidden(false);
        } else if (Math.abs(delta) > 8) {
          if (delta > 0) setHidden(true); // scrolling down
          else setHidden(false); // scrolling up
        }

        lastScrollY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHide]);

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
    <nav
      ref={navRef}
      className={[
        "aurevi-bottombar", // (nombre histórico; CSS lo convierte en TOPBAR)
        compact ? "is-compact" : "",
        hidden ? "is-hidden" : "",
      ].join(" ")}
      role="navigation"
      aria-label="Barra de navegación"
    >
      <div className="aurevi-bottombar-inner">
        <div className="aurevi-bottombar-scroll" ref={scrollRef}>
          <span
            className="active-bubble"
            style={{ left: `${bubble.left}px`, width: `${bubble.width}px` }}
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