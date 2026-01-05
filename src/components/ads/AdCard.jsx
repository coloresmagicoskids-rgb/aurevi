// src/components/ads/AdCard.jsx
import React, { useMemo } from "react";

/**
 * AUREVI — AdCard oficial (v1)
 * ------------------------------------------------------------
 * Anuncio nativo estilo “post” (no invasivo).
 *
 * Props:
 * - ad: objeto del anuncio
 *   Campos soportados (opcionales):
 *   {
 *     id,
 *     badge,          // texto del badge
 *     title,          // titulo
 *     text,           // descripcion corta
 *     imageUrl,       // imagen (si no hay, muestra placeholder)
 *     mediaType,      // "image" | "video" (v1: renderiza image; video se ignora por ahora)
 *     ctaLabel,       // texto boton
 *     href,           // URL externa
 *     target,         // "_blank" | "_self" (por defecto _blank)
 *     placement,      // "home" | "explore" | "album" etc (solo para tracking)
 *     sponsorName,    // marca/creador
 *     sponsorType,    // "creator" | "brand" | "aurevi"
 *     theme,          // "soft" | "strong" (v1: solo cambia sutiles)
 *     internalRoute,  // ruta interna de la app (si usas navigate)
 *   }
 *
 * - onClick(ad, meta): callback opcional para tracking
 * - navigate(route, params?): opcional (para abrir rutas internas en tu app)
 *
 * Nota:
 * - Este componente NO decide frecuencia.
 * - Frecuencia y selección de anuncios se hace en el feed (HomeFeed/Explore).
 */

export default function AdCard({ ad, onClick, navigate }) {
  if (!ad) return null;

  const safeAd = useMemo(() => {
    const {
      id = "ad_unknown",
      badge = "🤝 Patrocinado",
      title = "Descubre algo útil en AUREVI",
      text = "Apoya a creadores, cursos y productos sin interrumpir tu experiencia.",
      imageUrl = "",
      mediaType = "image",
      ctaLabel = "Ver",
      href = "",
      target = "_blank",
      placement = "",
      sponsorName = "",
      sponsorType = "",
      theme = "soft",
      internalRoute = "",
    } = ad || {};

    return {
      id,
      badge,
      title,
      text,
      imageUrl,
      mediaType,
      ctaLabel,
      href,
      target,
      placement,
      sponsorName,
      sponsorType,
      theme,
      internalRoute,
    };
  }, [ad]);

  const handleClick = () => {
    // Tracking seguro (no rompe)
    try {
      onClick?.(safeAd, {
        ts: Date.now(),
        placement: safeAd.placement || "unknown",
      });
    } catch {}

    // 1) Ruta interna (si existe navigate + internalRoute)
    if (navigate && safeAd.internalRoute) {
      try {
        navigate(safeAd.internalRoute);
        return;
      } catch {}
    }

    // 2) URL externa
    if (safeAd.href) {
      try {
        window.open(
          safeAd.href,
          safeAd.target || "_blank",
          "noopener,noreferrer"
        );
      } catch {}
    }
  };

  // Estilos “soft vs strong” (muy sutil, sin ser invasivo)
  const cardBg =
    safeAd.theme === "strong"
      ? "rgba(10, 16, 32, 0.42)"
      : "rgba(10, 16, 32, 0.28)";

  const headerHint =
    safeAd.sponsorName || safeAd.sponsorType
      ? `Por ${safeAd.sponsorName || "patrocinador"}`
      : "Ayuda a mantener AUREVI gratis";

  return (
    <article
      className="aurevi-card aurevi-adcard"
      role="article"
      aria-label="Contenido patrocinado"
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: cardBg,
        borderRadius: 18,
        overflow: "hidden",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            {safeAd.badge}
          </span>

          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            {headerHint}
          </span>
        </div>

        {/* micro-info de ubicación (opcional, útil para debug/analytics) */}
        {!!safeAd.placement && (
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.30)",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: "4px 8px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
            title="placement"
          >
            {safeAd.placement}
          </span>
        )}
      </div>

      {/* Media */}
      {safeAd.imageUrl ? (
        <button
          type="button"
          onClick={handleClick}
          title="Abrir"
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            width: "100%",
            cursor: "pointer",
            display: "block",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <img
              src={safeAd.imageUrl}
              alt={safeAd.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              loading="lazy"
            />
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          title="Abrir"
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            width: "100%",
            cursor: "pointer",
            display: "block",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,0,122,0.20), rgba(122,0,255,0.16), rgba(0,0,0,0.0))",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        </button>
      )}

      {/* Body */}
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "white" }}>
          {safeAd.title}
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "rgba(255,255,255,0.72)",
            lineHeight: 1.35,
          }}
        >
          {safeAd.text}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleClick}
            style={{
              border: "1px solid rgba(255,255,255,0.16)",
              background:
                "linear-gradient(135deg, rgba(255,120,200,0.92), rgba(120,160,255,0.92))",
              color: "#0b1020",
              fontWeight: 900,
              padding: "10px 12px",
              borderRadius: 14,
              cursor: "pointer",
            }}
          >
            {safeAd.ctaLabel}
          </button>
        </div>
      </div>
    </article>
  );
}