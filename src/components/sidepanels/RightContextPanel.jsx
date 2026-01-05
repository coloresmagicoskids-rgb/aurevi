// src/components/sidepanels/RightContextPanel.jsx
import React, { useMemo } from "react";
import MiniAdCard from "../ads/MiniAdCard.jsx";

/**
 * RightContextPanel
 * - Panel contextual para desktop/tablet.
 * - Muestra: contexto del video + resumen IA + resumen de reacciones + (ocasional) MiniAdCard.
 *
 * Props:
 * - video: objeto del post (likes, views, category, created_at opcional)
 * - analysis: { mood_detected, emotion, clarity, narrative_quality, creativity_score, advice } | null
 * - counts: objeto { reactionKey: number } (ej: { calma: 2, inspirado: 1 })
 * - myReaction: string | null
 * - visible: boolean (default true)
 * - compact: boolean (default false)
 * - ad: objeto ad (opcional) -> si viene, renderiza MiniAdCard
 * - onAdClick: (ad) => void
 */
export default function RightContextPanel({
  video,
  analysis,
  counts,
  myReaction,
  visible = true,
  compact = false,
  ad = null,
  onAdClick,
}) {
  const moodLabel = useMemo(() => {
    const mood = analysis?.mood_detected;
    if (!mood) return null;
    const map = {
      suave: "Suave / tranquilo",
      intenso: "Intenso",
      introspectivo: "Introspectivo",
      jugueton: "Juguetón",
      terapeutico: "Terapéutico",
    };
    return map[mood] || mood;
  }, [analysis?.mood_detected]);

  const reactionMeta = useMemo(() => {
    const order = [
      { key: "calma", label: "Calma", emoji: "😌" },
      { key: "inspirado", label: "Inspirado", emoji: "✨" },
      { key: "aprendi", label: "Aprendí", emoji: "📚" },
      { key: "me_rei", label: "Me reí", emoji: "😂" },
      { key: "me_ayudo", label: "Me ayudó", emoji: "🤝" },
    ];

    const total = Object.values(counts || {}).reduce((a, b) => a + (Number(b) || 0), 0);

    const top = [...order]
      .map((r) => ({ ...r, n: Number(counts?.[r.key] || 0) }))
      .sort((a, b) => b.n - a.n)[0];

    return { order, total, top: top?.n ? top : null };
  }, [counts]);

  const scorePill = (label, value) => {
    if (value == null) return null;
    const v = Math.max(1, Math.min(5, Number(value) || 1));
    return (
      <div
        style={{
          borderRadius: 999,
          padding: "6px 10px",
          background: "rgba(15,23,42,0.75)",
          border: "1px solid rgba(148,163,184,0.22)",
          color: "#e5e7eb",
          fontSize: 11,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
        }}
        title={`${label}: ${v}/5`}
      >
        <span style={{ color: "#cbd5e1" }}>{label}</span>
        <strong style={{ fontWeight: 800 }}>{v}/5</strong>
      </div>
    );
  };

  if (!visible) return null;

  return (
    <aside
      className={
        "aurevi-sidepanel aurevi-sidepanel-right aurevi-right-panel" +
        (compact ? " compact" : "")
      }
      style={{
        // 👇 No forzamos width fijo aquí (en móvil rompe el layout).
        // El tamaño en desktop lo maneja el grid/CSS.
        maxWidth: "32vw",
        alignSelf: "stretch",
        position: "relative",
      }}
    >
      <div
        className="aurevi-sidepanel-card"
        style={{
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(2,6,23,0.55)",
          backdropFilter: "blur(10px)",
          padding: compact ? "10px 10px" : "12px 12px",
        }}
      >
        {/* Contexto rápido */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#94a3b8",
              opacity: 0.9,
            }}
          >
            Contexto
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{ color: "#e5e7eb" }}>
              ❤️ <strong>{video?.likes ?? 0}</strong>
            </span>
            <span style={{ color: "#e5e7eb" }}>
              👁️ <strong>{video?.views ?? 0}</strong>
            </span>
            {video?.category && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.85)",
                  border: "1px solid rgba(148,163,184,0.18)",
                  color: "#e5e7eb",
                  fontSize: 11,
                }}
                title={`Categoría: ${video.category}`}
              >
                {video.category}
              </span>
            )}
          </div>

          {/* IA */}
          {analysis && (
            <div
              style={{
                marginTop: 6,
                padding: "10px 10px",
                borderRadius: 14,
                background: "rgba(15,23,42,0.75)",
                border: "1px solid rgba(148,163,184,0.22)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#e5e7eb",
                  marginBottom: 8,
                }}
              >
                IA del video
              </div>

              {moodLabel && (
                <div
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(30,64,175,0.85)",
                    color: "#e5e7eb",
                    marginBottom: 8,
                  }}
                  title={moodLabel}
                >
                  Clima: {moodLabel}
                </div>
              )}

              {analysis.emotion && (
                <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 8 }}>
                  Emoción: <strong style={{ color: "#e5e7eb" }}>{analysis.emotion}</strong>
                </div>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                {scorePill("Claridad", analysis.clarity)}
                {scorePill("Narrativa", analysis.narrative_quality)}
                {scorePill("Creatividad", analysis.creativity_score)}
              </div>

              {analysis.advice && (
                <div style={{ marginTop: 10, fontSize: 11, color: "#e5e7eb", lineHeight: 1.35 }}>
                  <span style={{ color: "#94a3b8", fontWeight: 800 }}>Tip:</span> {analysis.advice}
                </div>
              )}
            </div>
          )}

          {/* Reacciones (resumen) */}
          <div
            style={{
              marginTop: 6,
              padding: "10px 10px",
              borderRadius: 14,
              background: "rgba(2,6,23,0.35)",
              border: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#e5e7eb" }}>Reacciones</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Total: <strong style={{ color: "#e5e7eb" }}>{reactionMeta.total}</strong>
              </div>
            </div>

            {reactionMeta.top && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#cbd5e1" }}>
                Top:{" "}
                <strong style={{ color: "#e5e7eb" }}>
                  {reactionMeta.top.emoji} {reactionMeta.top.label} ({reactionMeta.top.n})
                </strong>
              </div>
            )}

            {myReaction && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#cbd5e1" }}>
                Tu reacción: <strong style={{ color: "#e5e7eb" }}>{myReaction}</strong>
              </div>
            )}

            {/* ✅ AHORA HORIZONTAL (chips) + scroll si no caben */}
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "nowrap", // ✅ horizontal
                overflowX: "auto", // ✅ scroll en móvil si hace falta
                paddingBottom: 6,
                WebkitOverflowScrolling: "touch",
              }}
            >
              {reactionMeta.order.map((r) => {
                const n = Number(counts?.[r.key] || 0);
                return (
                  <span
                    key={r.key}
                    style={{
                      flex: "0 0 auto",
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: "rgba(15,23,42,0.75)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      color: "#e5e7eb",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    title={`${r.label}: ${n}`}
                  >
                    <span style={{ opacity: 0.95 }}>{r.emoji}</span>
                    <strong style={{ fontWeight: 800 }}>{n}</strong>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Mini Ad (opcional) */}
          {ad && (
            <div style={{ marginTop: 10 }}>
              <MiniAdCard
                ad={ad}
                onClick={(x) => {
                  onAdClick?.(x);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}