// src/components/VideoReactions.jsx
import React from "react";

const REACTIONS = [
  { key: "calma", label: "Calma 😌" },
  { key: "inspirado", label: "Inspirado ✨" },
  { key: "aprendi", label: "Aprendí 📚" },
  { key: "me_rei", label: "Me reí 😂" },
  { key: "me_ayudo", label: "Me ayudó 🤝" },
];

function VideoReactions({ videoId, userReaction, counts = {}, onReact }) {
  return (
    <div className="aurevi-reactions-row">
      {REACTIONS.map((r) => {
        const isActive = userReaction === r.key;
        return (
          <button
            key={r.key}
            type="button"
           className={
  "aurevi-reaction-pill " +
  `aurevi-reaction-pill--${r.key} ` +
  (userReaction === r.key ? "aurevi-reaction-pill--active" : "")
}
            onClick={() => onReact && onReact(r.key)}
          >
            <span>{r.label}</span>
            {counts[r.key] ? (
              <span className="aurevi-reaction-count">{counts[r.key]}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default VideoReactions;