import React, { useState } from "react";

export default function MessageInput({
  disabled = false,
  onSend = async () => {},
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const clean = (text || "").trim();
    if (!clean || disabled || sending) return;

    try {
      setSending(true);
      await onSend(clean); // el padre hará el insert real
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        padding: 12,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <input
        value={text}
        disabled={disabled || sending}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={
          disabled ? "Selecciona una conversación…" : "Escribe un mensaje…"
        }
        style={{
          flex: 1,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(10,16,32,0.35)",
          color: "white",
          padding: "10px 12px",
          outline: "none",
          fontSize: 14,
        }}
      />

      <button
        onClick={send}
        disabled={disabled || sending}
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          background:
            disabled || sending
              ? "rgba(255,255,255,0.06)"
              : "linear-gradient(135deg, rgba(255,120,200,0.9), rgba(120,160,255,0.9))",
          color: disabled || sending ? "rgba(255,255,255,0.6)" : "#0b1020",
          fontWeight: 900,
          padding: "10px 14px",
          borderRadius: 14,
          cursor: disabled || sending ? "not-allowed" : "pointer",
          opacity: sending ? 0.85 : 1,
        }}
      >
        {sending ? "Enviando..." : "Enviar"}
      </button>
    </div>
  );
}