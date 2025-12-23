import React from "react";

export default function MessageBubble({ message, isMine }) {
  const text = message?.text || "";
  const time = message?.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          padding: "10px 12px",
          borderRadius: 16,
          borderTopLeftRadius: isMine ? 16 : 6,
          borderTopRightRadius: isMine ? 6 : 16,
          background: isMine
            ? "linear-gradient(135deg, rgba(255, 120, 200, 0.85), rgba(120, 160, 255, 0.85))"
            : "rgba(255,255,255,0.08)",
          color: isMine ? "#0b1020" : "white",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ fontSize: 14, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>
          {text}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            opacity: 0.75,
            textAlign: "right",
          }}
        >
          {time}
        </div>
      </div>
    </div>
  );
}
