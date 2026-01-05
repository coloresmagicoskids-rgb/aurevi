//src/components/ads/MiniAdCard.jsx
import React from "react";

/**
 * MiniAdCard
 * - Versión compacta de un anuncio para sidepanels.
 *
 * Props:
 * - ad: { id, badge, title, text, imageUrl, ctaLabel, href, placement, theme }
 * - onClick: (ad) => void
 * - compact: boolean (default true)
 */
export default function MiniAdCard({ ad, onClick, compact = true }) {
  if (!ad) return null;

  const handleClick = () => {
    onClick?.(ad);
    if (ad.href) {
      // abre en nueva pestaña sin romper SPA
      window.open(ad.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <aside
      className={"aurevi-mini-adcard" + (compact ? " compact" : "")}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.22)",
        background: "rgba(2,6,23,0.55)",
        backdropFilter: "blur(10px)",
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div style={{ padding: "10px 10px 8px 10px" }}>
        {ad.badge && (
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#cbd5e1",
              opacity: 0.85,
              marginBottom: 6,
            }}
            title={ad.badge}
          >
            {ad.badge}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* image */}
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 12,
              background: "rgba(15,23,42,0.7)",
              border: "1px solid rgba(148,163,184,0.20)",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ad.imageUrl ? (
              <img
                src={ad.imageUrl}
                alt={ad.title || "Anuncio"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <span style={{ fontSize: 18 }}>📣</span>
            )}
          </div>

          {/* text */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#e5e7eb",
                lineHeight: 1.12,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={ad.title}
            >
              {ad.title || "Recomendado"}
            </div>

            {ad.text && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: "#94a3b8",
                  lineHeight: 1.25,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                title={ad.text}
              >
                {ad.text}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleClick}
          style={{
            width: "100%",
            marginTop: 10,
            border: "none",
            borderRadius: 999,
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
            color: "#fff",
          }}
        >
          {ad.ctaLabel || "Ver"}
        </button>

        <div style={{ marginTop: 8, fontSize: 10, color: "#64748b" }}>
          Patrocinado • {ad.placement || "home"}
        </div>
      </div>
    </aside>
  );
}