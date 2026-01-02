// src/components/ads/AdCard.jsx
import React from "react";

/**
 * Anuncio nativo estilo “post”.
 * Props:
 * - ad: { id, badge, title, text, imageUrl, ctaLabel, href }
 * - onClick: opcional (tracking)
 */
export default function AdCard({ ad, onClick }) {
  if (!ad) return null;

  const {
    badge = "🤝 Apoyo creativo",
    title = "Edita más rápido tus videos",
    text = "Plantillas y transiciones listas para creadores. Sin complicarte.",
    imageUrl = "",
    ctaLabel = "Conocer",
    href = "#",
  } = ad;

  const handleClick = () => {
    try {
      onClick?.(ad);
    } catch {}
    // Abrir enlace (nueva pestaña)
    if (href && href !== "#") window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <article
      className="aurevi-card aurevi-adcard"
      role="article"
      aria-label="Contenido patrocinado"
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(10, 16, 32, 0.28)",
        borderRadius: 18,
        overflow: "hidden",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Header */}
      <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
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
          {badge}
        </span>

        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          Ayuda a mantener AUREVI gratis
        </span>
      </div>

      {/* Media */}
      {imageUrl ? (
        <div
          style={{
            width: "100%",
            aspectRatio: "16/9",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <img
            src={imageUrl}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            loading="lazy"
          />
        </div>
      ) : (
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
      )}

      {/* Body */}
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "white" }}>
          {title}
        </div>

        <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
          {text}
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
            {ctaLabel}
          </button>
        </div>
      </div>
    </article>
  );
}