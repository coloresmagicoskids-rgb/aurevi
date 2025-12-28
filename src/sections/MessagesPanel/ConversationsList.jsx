// ConversationsList.jsx
import React from "react";
import ConversationItem from "./ConversationItem.jsx";

export default function ConversationsList({
  conversations = [],
  activeId = null,
  onSelect = () => {},
  onNew = () => {},
  onReload = null, // opcional: si quieres un botón ↻ que llame al padre
  loading = false, // opcional
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(10, 16, 32, 0.35)",
        backdropFilter: "blur(10px)",
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 14px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "white" }}>
            Tus conversaciones
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
            Busca un contacto y comienza un chat
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {!!onReload && (
            <button
              onClick={onReload}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                fontWeight: 700,
                padding: "8px 10px",
                borderRadius: 12,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
              title="Recargar conversaciones"
              disabled={loading}
            >
              {loading ? "..." : "↻"}
            </button>
          )}

          <button
            onClick={onNew}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(135deg, rgba(255,120,200,0.9), rgba(120,160,255,0.9))",
              color: "#0b1020",
              fontWeight: 900,
              padding: "8px 10px",
              borderRadius: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Nuevo mensaje"
          >
            + Nuevo mensaje
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: 10, overflowY: "auto", flex: 1 }}>
        {loading && conversations.length === 0 ? (
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px dashed rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.75)",
              fontSize: 13,
            }}
          >
            Cargando conversaciones...
          </div>
        ) : conversations.length === 0 ? (
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px dashed rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.75)",
              fontSize: 13,
            }}
          >
            No tienes conversaciones todavía.
            <div style={{ marginTop: 6, color: "rgba(255,255,255,0.6)" }}>
              Pulsa <b>+ Nuevo mensaje</b> para buscar un contacto.
            </div>
          </div>
        ) : (
          conversations.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c} // <- aquí viene title/unread/isOnline/lastMessage
              active={c.id === activeId}
              onClick={() => onSelect(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}