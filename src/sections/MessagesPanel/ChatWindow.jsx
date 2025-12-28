import React, { useEffect, useMemo, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";

function formatLastSeen(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return `Últ. vez hoy a las ${time}`;

  const date = d.toLocaleDateString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `Últ. vez ${date} ${time}`;
}

export default function ChatWindow({
  conversation = null,
  messages = [],
  currentUserId = "me",
  onSend = () => {},
}) {
  const bottomRef = useRef(null);
  const empty = !conversation;

  // Auto-scroll cuando llegan mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, conversation?.id]);

  const headerRight = useMemo(() => {
    return (
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
        {conversation?.typingText ? conversation.typingText : ""}
      </div>
    );
  }, [conversation]);

  const headerName = conversation?.headerName || conversation?.title || "Chat";

  // ✅ Presence “modo WhatsApp”
  const isOnline = !!conversation?.isOnline;
  const lastSeenAt = conversation?.lastSeenAt || null;

  // Subtítulo final:
  // 1) typing > 2) online/lastSeen (si es DM) > 3) fallback existente
  const baseSubtitle =
    conversation?.headerSubtitle ||
    (empty
      ? "Selecciona una conversación a la izquierda"
      : "Escribe y envía mensajes");

  const presenceSubtitle = isOnline
    ? "En línea"
    : lastSeenAt
      ? formatLastSeen(lastSeenAt)
      : "";

  const headerSubtitle =
    conversation?.typingText?.trim()
      ? conversation.typingText
      : presenceSubtitle || baseSubtitle;

  const avatarUrl = conversation?.headerAvatar || null;

  const Avatar = () => {
    const size = 34;

    if (!avatarUrl) {
      const letter = (headerName || "C").trim().charAt(0).toUpperCase();
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            color: "white",
            background:
              "linear-gradient(135deg, rgba(255,120,200,0.55), rgba(120,160,255,0.55))",
            border: "1px solid rgba(255,255,255,0.14)",
            flexShrink: 0,
            position: "relative",
          }}
          title={headerName}
        >
          {letter}

          {/* ✅ Puntito online */}
          {isOnline && (
            <span
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "rgba(34,197,94,1)",
                border: "2px solid rgba(10,16,32,0.9)",
              }}
            />
          )}
        </div>
      );
    }

    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <img
          src={avatarUrl}
          alt={headerName}
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            objectFit: "cover",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        />

        {/* ✅ Puntito online */}
        {isOnline && (
          <span
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "rgba(34,197,94,1)",
              border: "2px solid rgba(10,16,32,0.9)",
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "rgba(10, 16, 32, 0.22)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        overflow: "hidden",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {!empty && <Avatar />}

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                color: "white",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={headerName}
            >
              {headerName}
            </div>

            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.65)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={headerSubtitle}
            >
              {headerSubtitle}
            </div>
          </div>
        </div>

        {headerRight}
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {empty ? (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: "rgba(255,255,255,0.7)",
              border: "1px dashed rgba(255,255,255,0.16)",
              borderRadius: 16,
              padding: 16,
              maxWidth: 420,
            }}
          >
            <div style={{ fontWeight: 900, color: "white" }}>
              Selecciona una conversación
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Elige un chat a la izquierda para ver los mensajes.
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: "rgba(255,255,255,0.7)",
              border: "1px dashed rgba(255,255,255,0.16)",
              borderRadius: 16,
              padding: 16,
              maxWidth: 420,
            }}
          >
            <div style={{ fontWeight: 900, color: "white" }}>
              No hay mensajes todavía
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Escribe el primero abajo 👇
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isMine={m.senderId === currentUserId}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <MessageInput disabled={empty} onSend={onSend} />
    </div>
  );
}