// src/components/WorldSwitcher.jsx
import React from "react";
import { useWorld } from "../worlds/WorldContext";
import { WORLD_LABELS } from "../worlds/worldTypes";

// Si en tu worldTypes tienes otra estructura, ajusta este arreglo:
const WORLD_ORDER = ["publico", "creadores", "infantil", "bienestar", "experimental"].filter(
  Boolean
);

function WorldSwitcher() {
  const { activeWorld, setActiveWorld } = useWorld();

  return (
    <div
      className="aurevi-world-switcher"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px",
        borderRadius: 999,
        background: "rgba(15,23,42,0.9)",
        border: "1px solid rgba(148,163,184,0.4)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          opacity: 0.7,
        }}
      >
        Mundo
      </span>

      <div
        style={{
          display: "flex",
          gap: 4,
        }}
      >
        {WORLD_ORDER.map((worldId) => (
          <button
            key={worldId}
            type="button"
            onClick={() => setActiveWorld(worldId)}
            className={
              "aurevi-world-pill" +
              (activeWorld === worldId ? " aurevi-world-pill-active" : "")
            }
            style={{
              border: "none",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
              background:
                activeWorld === worldId
                  ? "linear-gradient(90deg,#f97316,#eab308)"
                  : "rgba(15,23,42,0.9)",
              color: activeWorld === worldId ? "#020617" : "#e5e7eb",
              transition: "background 0.15s ease, transform 0.1s ease",
            }}
          >
            {WORLD_LABELS[worldId] || worldId}
          </button>
        ))}
      </div>
    </div>
  );
}

export default WorldSwitcher;