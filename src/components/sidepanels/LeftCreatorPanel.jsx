// src/components/sidepanels/LeftCreatorPanel.jsx
import React, { useMemo } from "react";

/**
 * LeftCreatorPanel
 * - Panel contextual para desktop/tablet.
 * - Muestra creador + badge + seguir/siguiendo.
 * - "Nada fijo": se puede ocultar con props según estado (playing/scrolling/etc).
 *
 * Props:
 * - video: objeto del post (necesita user_id, title opcional)
 * - creator: { id, display_name, username, avatar_url, creative_trend } (opcional)
 * - currentUserId: string | null
 * - isFollowing: boolean
 * - isOwn: boolean
 * - onToggleFollow: (targetUserId) => void
 * - visible: boolean (default true)
 * - compact: boolean (default false) // versión más chiquita si quieres
 */
export default function LeftCreatorPanel({
  video,
  creator,
  currentUserId,
  isFollowing,
  isOwn,
  onToggleFollow,
  visible = true,
  compact = false,
}) {
  const targetUserId = video?.user_id || creator?.id || null;

  const trendLabel = useMemo(() => {
    const t = creator?.creative_trend;
    if (!t) return null;
    return (
      {
        explorador: "Explorador de ideas",
        constructor: "Constructor/a de conocimientos",
        narrador: "Narrador/a",
        musico: "Músico / sonoro",
        mentor: "Mentor / guía",
        multicreativo: "Multicreativo",
      }[t] || t
    );
  }, [creator?.creative_trend]);

  const displayName = useMemo(() => {
    return (
      creator?.display_name ||
      (creator?.username ? `@${creator.username}` : null) ||
      "Creador/a"
    );
  }, [creator?.display_name, creator?.username]);

  const fallbackLetter = useMemo(() => {
    const base = creator?.display_name || creator?.username || video?.title || "A";
    return String(base).trim().charAt(0).toUpperCase() || "A";
  }, [creator?.display_name, creator?.username, video?.title]);

  const canFollow = Boolean(currentUserId && targetUserId && !isOwn);

  if (!visible) return null;

  return (
    <aside
      className={"aurevi-sidepanel aurevi-sidepanel-left" + (compact ? " compact" : "")}
      style={{
        width: compact ? 220 : 260,
        maxWidth: "28vw",
        alignSelf: "stretch",
        position: "relative",
      }}
    >
      <div
        className="aurevi-sidepanel-card"
        style={{
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,0.25)",
          background: "rgba(2,6,23,0.6)",
          backdropFilter: "blur(10px)",
          padding: compact ? "10px 10px" : "12px 12px",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Avatar */}
          <div
            style={{
              width: compact ? 44 : 52,
              height: compact ? 44 : 52,
              borderRadius: 999,
              background:
                "radial-gradient(circle at 30% 20%, #f97316, #4f46e5 55%, #020617)",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f9fafb",
              fontWeight: 700,
              fontSize: compact ? 14 : 16,
            }}
            title={displayName}
          >
            {creator?.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt="Avatar creador"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>{fallbackLetter}</span>
            )}
          </div>

          {/* Nombre + badge */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: compact ? 13 : 14,
                fontWeight: 700,
                color: "#e5e7eb",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={displayName}
            >
              {displayName}
            </div>

            {trendLabel && (
              <div
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.85)",
                  border: "1px solid rgba(148,163,184,0.25)",
                  color: "#e5e7eb",
                  whiteSpace: "nowrap",
                }}
                title={trendLabel}
              >
                {trendLabel}
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!canFollow}
            onClick={() => {
              if (!canFollow) return;
              onToggleFollow?.(targetUserId);
            }}
            style={{
              border: "none",
              borderRadius: 999,
              padding: compact ? "8px 12px" : "9px 14px",
              cursor: canFollow ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 700,
              background: !canFollow
                ? "rgba(71,85,105,0.5)"
                : isFollowing
                ? "rgba(31,41,55,0.95)"
                : "linear-gradient(90deg, #4f46e5, #7c3aed)",
              color: "#fff",
              flex: "1 1 auto",
              minWidth: 140,
              opacity: !canFollow ? 0.6 : 1,
            }}
            title={!canFollow ? "Inicia sesión para seguir" : isFollowing ? "Dejar de seguir" : "Seguir"}
          >
            {isOwn ? "Tu perfil" : isFollowing ? "Siguiendo" : "Seguir"}
          </button>

          {/* Slot contextual (opcional): por ahora vacío a propósito */}
          {/* Aquí luego podrías meter: "Enviar mensaje", "Ver perfil", etc. */}
        </div>

        {/* Nota contextual suave (opcional) */}
        {!currentUserId && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>
            Inicia sesión para seguir creadores y ajustar tu feed.
          </div>
        )}
      </div>
    </aside>
  );
}