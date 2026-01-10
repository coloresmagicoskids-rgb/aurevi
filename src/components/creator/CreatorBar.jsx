// src/components/creator/CreatorBar.jsx
import React from "react";

export default function CreatorBar({
  creator,
  isOwn,
  isFollowing,
  onToggleFollow,
  showFollow = true,
}) {
  const letter =
    creator?.display_name?.[0]?.toUpperCase() ||
    creator?.username?.[0]?.toUpperCase() ||
    "A";

  return (
    <div
      className="aurevi-creatorbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            overflow: "hidden",
            flexShrink: 0,
            background:
              "radial-gradient(circle at 30% 20%, #f97316, #4f46e5 55%, #020617)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f9fafb",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {creator?.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt="Avatar creador"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{letter}</span>
          )}
        </div>

        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#e5e7eb" }}>
            {creator?.display_name || creator?.username || "Creador/a"}
          </div>
          {creator?.creative_trend && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {creator.creative_trend}
            </div>
          )}
        </div>
      </div>

      {showFollow && !isOwn && creator?.id && (
        <button
          type="button"
          onClick={() => onToggleFollow?.(creator.id)}
          style={{
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.35)",
            padding: "6px 12px",
            fontSize: 13,
            cursor: "pointer",
            background: isFollowing ? "rgba(15,23,42,0.9)" : "rgba(79,70,229,0.85)",
            color: "#fff",
          }}
        >
          {isFollowing ? "Siguiendo" : "Seguir"}
        </button>
      )}
    </div>
  );
}