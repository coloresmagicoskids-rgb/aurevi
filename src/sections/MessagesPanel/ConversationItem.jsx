import React from "react";

export default function ConversationItem({ conversation, active, onClick }) {
  const title = conversation?.title || "Conversación";
  const subtitle =
    conversation?.lastMessage?.text || "Sin mensajes todavía...";
  const unread = conversation?.unreadCount || 0;

  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        padding: 12,
        borderRadius: 14,
        marginBottom: 8,
        border: active
          ? "1px solid rgba(120,160,255,0.55)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? "linear-gradient(180deg, rgba(60,120,255,0.18), rgba(255,255,255,0.04))"
          : "rgba(255,255,255,0.03)",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background:
            "linear-gradient(135deg, rgba(255,120,200,0.65), rgba(120,200,255,0.65))",
          display: "grid",
          placeItems: "center",
          color: "#0b1020",
          fontWeight: 900,
        }}
      >
        {title.trim().slice(0, 1).toUpperCase()}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              color: "white",
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>

          {unread > 0 && (
            <div
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 999,
                padding: "0 7px",
                display: "grid",
                placeItems: "center",
                background: "rgba(255, 90, 90, 0.95)",
                color: "white",
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              {unread}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 4,
            color: "rgba(255,255,255,0.65)",
            fontSize: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
