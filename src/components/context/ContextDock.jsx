// src/components/context/ContextDock.jsx
import React, { useMemo } from "react";

/**
 * ContextDock
 * - Barra/contexto horizontal para móvil y desktop.
 * - Muestra likes/views/categoría + reacciones en formato chips.
 *
 * Props:
 * - video: { likes, views, category }
 * - counts: { calma, inspirado, aprendi, me_rei, me_ayudo } (numbers)
 * - myReaction: string | null
 * - variant: "default" | "compact" (opcional)
 */
export default function ContextDock({
  video,
  counts,
  myReaction,
  variant = "default",
}) {
  const reactionMeta = useMemo(() => {
    const order = [
      { key: "calma", label: "Calma", emoji: "😌" },
      { key: "inspirado", label: "Inspirado", emoji: "✨" },
      { key: "aprendi", label: "Aprendí", emoji: "📚" },
      { key: "me_rei", label: "Me reí", emoji: "😂" },
      { key: "me_ayudo", label: "Me ayudó", emoji: "🤝" },
    ];

    const total = Object.values(counts || {}).reduce(
      (a, b) => a + (Number(b) || 0),
      0
    );

    const top = [...order]
      .map((r) => ({ ...r, n: Number(counts?.[r.key] || 0) }))
      .sort((a, b) => b.n - a.n)[0];

    return { order, total, top: top?.n ? top : null };
  }, [counts]);

  const isCompact = variant === "compact";

  return (
    <div className={"aurevi-contextdock" + (isCompact ? " compact" : "")}>
      {/* Header mini: likes / views / category */}
      <div className="aurevi-contextdock-top">
        <span className="pill">
          ❤️ <strong>{video?.likes ?? 0}</strong>
        </span>

        <span className="pill">
          👁️ <strong>{video?.views ?? 0}</strong>
        </span>

        {video?.category && (
          <span className="pill tag" title={`Categoría: ${video.category}`}>
            {video.category}
          </span>
        )}

        <span className="spacer" />

        <span className="meta">
          Total: <strong>{reactionMeta.total}</strong>
        </span>
      </div>

      {/* Chips horizontales de reacciones */}
      <div className="aurevi-contextdock-chips" role="list">
        {reactionMeta.order.map((r) => {
          const n = Number(counts?.[r.key] || 0);
          const active = myReaction === r.key;
          return (
            <span
              key={r.key}
              className={"chip" + (active ? " active" : "")}
              title={`${r.label}: ${n}`}
              role="listitem"
            >
              {r.emoji} <strong>{n}</strong>
            </span>
          );
        })}

        {reactionMeta.top && (
          <span className="chip top" title="Reacción más usada">
            Top: {reactionMeta.top.emoji} <strong>{reactionMeta.top.n}</strong>
          </span>
        )}
      </div>
    </div>
  );
}