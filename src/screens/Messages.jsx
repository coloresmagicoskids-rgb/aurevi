// src/screens/Messages.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import {
  getCurrentUser,
  fetchConversationsForUser,
  fetchMessages,
  sendMessage,
  createConversation,
  fetchMembersForConversations,
  fetchUnreadCountsForUser,
  markConversationRead,
  setTypingStatus,
  fetchTypingUsers,
} from "../services/messageService";

function Messages() {
  const [currentUser, setCurrentUser] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [membersByConv, setMembersByConv] = useState({});
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [unreadByConv, setUnreadByConv] = useState({});
  const [typingUserIds, setTypingUserIds] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Helpers
  const getProfileName = (profile) => {
    if (!profile) return "Creador";
    return (
      profile.display_name ||
      profile.username ||
      profile.full_name ||
      profile.nickname ||
      profile.handle ||
      profile.email ||
      "Creador"
    );
  };

  const getInitials = (nameOrEmail) => {
    if (!nameOrEmail) return "A";
    const base = nameOrEmail.split("@")[0];
    const parts = base.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      (parts[0].charAt(0) || "").toUpperCase() +
      (parts[1].charAt(0) || "").toUpperCase()
    );
  };

  const getDisplayNameForConversation = (conv) => {
    if (!conv) return "";
    const members = membersByConv[conv.id] || [];
    if (!currentUser) return conv.title || "Conversación";
    const others = members.filter((m) => m.id !== currentUser.id);
    if (others.length === 0) return conv.title || "Notas personales";
    if (others.length === 1) return getProfileName(others[0]);
    const names = others.map(getProfileName);
    return (
      conv.title ||
      `${names[0]}${names[1] ? ", " + names[1] : ""}${
        others.length > 2 ? ` +${others.length - 2}` : ""
      }`
    );
  };

  const getAvatarForConversation = (conv) => {
    if (!conv) return null;
    const members = membersByConv[conv.id] || [];
    const candidates = currentUser
      ? members.filter((m) => m.id !== currentUser.id)
      : members;
    const target = candidates[0] || members[0] || null;
    return target || null;
  };

  // Autoscroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedConv]);

  // Cargar usuario + conversaciones
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        if (!user) {
          setErrorMsg("Necesitas iniciar sesión para usar los mensajes.");
          setLoading(false);
          return;
        }
        setCurrentUser(user);

        const convos = await fetchConversationsForUser(user.id);
        setConversations(convos);
        if (convos.length > 0) setSelectedConv(convos[0]);
      } catch (err) {
        console.error(err);
        setErrorMsg("Error cargando tus conversaciones.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Cargar miembros
  useEffect(() => {
    const loadMembers = async () => {
      try {
        if (!currentUser || conversations.length === 0) {
          setMembersByConv({});
          return;
        }
        const ids = conversations.map((c) => c.id).filter(Boolean);
        const map = await fetchMembersForConversations(ids);
        setMembersByConv(map);
      } catch (err) {
        console.error("Error cargando miembros de conversaciones:", err);
      }
    };
    loadMembers();
  }, [currentUser, conversations]);

  // Cargar contadores de no leídos
  useEffect(() => {
    const loadUnread = async () => {
      try {
        if (!currentUser || conversations.length === 0) {
          setUnreadByConv({});
          return;
        }
        const ids = conversations.map((c) => c.id).filter(Boolean);
        const map = await fetchUnreadCountsForUser(currentUser.id, ids);
        setUnreadByConv(map);
      } catch (err) {
        console.error("Error cargando contadores de no leídos:", err);
      }
    };
    loadUnread();
  }, [currentUser, conversations]);

  // Cargar mensajes al cambiar de conversación
  useEffect(() => {
    const loadMsgs = async () => {
      if (!selectedConv) {
        setMessages([]);
        return;
      }
      try {
        const msgs = await fetchMessages(selectedConv.id);
        setMessages(msgs);
      } catch (err) {
        console.error(err);
        setErrorMsg("Error cargando mensajes.");
      }
    };
    loadMsgs();
  }, [selectedConv]);

  // Polling simple de quién está escribiendo en la conversación actual
  useEffect(() => {
    if (!selectedConv || !currentUser) {
      setTypingUserIds([]);
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const ids = await fetchTypingUsers(selectedConv.id, currentUser.id);
        if (!cancelled) setTypingUserIds(ids);
      } catch (err) {
        console.error("Error leyendo typing:", err);
      }
    }, 2000); // cada 2 segundos

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedConv, currentUser]);

  // Seleccionar conversación + marcar leída
  const handleSelectConversation = async (conv) => {
    setSelectedConv(conv);
    if (!currentUser) return;
    try {
      await markConversationRead(conv.id, currentUser.id);
      setUnreadByConv((prev) => ({ ...prev, [conv.id]: 0 }));
    } catch (err) {
      console.error("Error marcando conversación como leída:", err);
    }
  };

  // Cambio en el input (aquí activamos "está escribiendo")
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!currentUser || !selectedConv) return;

    // marcamos que está escribiendo
    setTypingStatus({
      conversationId: selectedConv.id,
      userId: currentUser.id,
      isTyping: true,
    }).catch((err) => console.error("Error setTypingStatus:", err));

    // si deja de teclear 3s, marcamos false
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus({
        conversationId: selectedConv.id,
        userId: currentUser.id,
        isTyping: false,
      }).catch((err) => console.error("Error clear typing:", err));
    }, 3000);
  };

  // Enviar mensaje
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !selectedConv) return;

    try {
      setErrorMsg("");
      const msg = await sendMessage({
        conversationId: selectedConv.id,
        senderId: currentUser.id,
        content: newMessage,
      });

      setMessages((prev) => [...prev, msg]);
      setNewMessage("");

      // deja de escribir al enviar
      setTypingStatus({
        conversationId: selectedConv.id,
        userId: currentUser.id,
        isTyping: false,
      }).catch(() => {});
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      setUnreadByConv((prev) => ({ ...prev, [selectedConv.id]: 0 }));
      await markConversationRead(selectedConv.id, currentUser.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("No se pudo enviar el mensaje.");
    }
  };

  // Crear conversación de prueba
  const handleCreateTestConversation = async () => {
    if (!currentUser) return;
    try {
      const convId = await createConversation({
        title: "Conversación de prueba",
        memberIds: [currentUser.id],
      });

      const convos = await fetchConversationsForUser(currentUser.id);
      setConversations(convos);
      const found = convos.find((c) => c.id === convId);
      if (found) setSelectedConv(found);
    } catch (err) {
      console.error(err);
      setErrorMsg("No se pudo crear la conversación de prueba.");
    }
  };

  // Eliminar conversación desde header
  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    const confirmDelete = window.confirm(
      "¿Seguro que quieres eliminar esta conversación?"
    );
    if (!confirmDelete) return;

    try {
      setErrorMsg("");
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", selectedConv.id);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo eliminar la conversación.");
        return;
      }

      setConversations((prev) =>
        prev.filter((c) => c.id !== selectedConv.id)
      );
      setUnreadByConv((prev) => {
        const copy = { ...prev };
        delete copy[selectedConv.id];
        return copy;
      });
      setSelectedConv(null);
      setMessages([]);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error inesperado al eliminar la conversación.");
    }
  };

  // Eliminar desde la lista
  const handleDeleteConversationFromList = async (convId) => {
    const confirmDelete = window.confirm(
      "¿Seguro que quieres eliminar esta conversación?"
    );
    if (!confirmDelete) return;

    try {
      setErrorMsg("");
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", convId);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo eliminar la conversación.");
        return;
      }

      setConversations((prev) => prev.filter((c) => c.id !== convId));
      setUnreadByConv((prev) => {
        const copy = { ...prev };
        delete copy[convId];
        return copy;
      });

      if (selectedConv?.id === convId) {
        setSelectedConv(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error inesperado al eliminar la conversación.");
    }
  };

  // Construir texto "X está escribiendo..."
  const renderTypingText = () => {
    if (!selectedConv || typingUserIds.length === 0) return null;

    const members = membersByConv[selectedConv.id] || [];
    const othersProfiles = members.filter((m) =>
      typingUserIds.includes(m.id)
    );

    if (othersProfiles.length === 0) {
      return "Alguien está escribiendo…";
    }
    if (othersProfiles.length === 1) {
      return `${getProfileName(othersProfiles[0])} está escribiendo…`;
    }
    return "Varias personas están escribiendo…";
  };

  // ---- RENDER ----
  return (
    <section className="aurevi-screen">
      <div className="aurevi-screen-header">
        <h2 className="aurevi-screen-title">Mensajes</h2>
        <p className="aurevi-screen-description">
          Conversa con otros creadores dentro de AUREVI.
        </p>
      </div>

      {loading && <p style={{ color: "#9ca3af" }}>Cargando mensajes...</p>}

      {errorMsg && (
        <p style={{ color: "#f97373", fontSize: 13, marginTop: 8 }}>
          {errorMsg}
        </p>
      )}

      {!loading && !currentUser && (
        <p style={{ marginTop: 12 }}>
          Inicia sesión para activar tu sistema de mensajes.
        </p>
      )}

      {!loading && currentUser && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 2fr)",
            gap: 12,
            marginTop: 12,
          }}
        >
          {/* Lista de conversaciones */}
          <div
            style={{
              borderRadius: 16,
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(148,163,184,0.4)",
              padding: 10,
              minHeight: 260,
              maxHeight: "65vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ fontSize: 14, margin: 0 }}>Tus conversaciones</h3>
              <button
                type="button"
                onClick={handleCreateTestConversation}
                style={{
                  fontSize: 11,
                  borderRadius: 999,
                  padding: "4px 10px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    "linear-gradient(90deg,#6366f1,#a855f7,#f97316)",
                  color: "#f9fafb",
                }}
              >
                + Crear prueba
              </button>
            </div>

            {conversations.length === 0 && (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                No tienes conversaciones todavía. Crea una de prueba para
                empezar a ver el flujo.
              </p>
            )}

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {conversations.map((conv) => {
                const avatarProfile = getAvatarForConversation(conv);
                const displayName = getDisplayNameForConversation(conv);
                const initials = getInitials(
                  avatarProfile
                    ? getProfileName(avatarProfile)
                    : conv.title || currentUser.email
                );
                const unreadCount = unreadByConv[conv.id] || 0;

                return (
                  <li key={conv.id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectConversation(conv)}
                        style={{
                          flex: 1,
                          textAlign: "left",
                          borderRadius: 12,
                          border: "1px solid rgba(55,65,81,0.9)",
                          padding: "6px 10px",
                          background:
                            selectedConv?.id === conv.id
                              ? "rgba(55,65,81,0.9)"
                              : "rgba(15,23,42,0.9)",
                          color: "#e5e7eb",
                          cursor: "pointer",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          fontWeight: unreadCount > 0 ? 600 : 400,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "999px",
                              background:
                                "radial-gradient(circle at 30% 20%, #f97316, #4f46e5 55%, #020617)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                              fontSize: 11,
                              color: "#f9fafb",
                              fontWeight: 600,
                            }}
                          >
                            {avatarProfile?.avatar_url ? (
                              <img
                                src={avatarProfile.avatar_url}
                                alt="Avatar"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>

                          <span
                            style={{
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            }}
                          >
                            {displayName}
                          </span>
                        </div>

                        {unreadCount > 0 && (
                          <span
                            style={{
                              minWidth: 20,
                              height: 20,
                              borderRadius: 999,
                              background: "#f97316",
                              color: "#0f172a",
                              fontSize: 11,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "0 6px",
                            }}
                          >
                            {unreadCount}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteConversationFromList(conv.id)
                        }
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "999px",
                          border: "none",
                          background: "#ef4444",
                          color: "#fff",
                          fontSize: 12,
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                        title="Eliminar conversación"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Área de chat */}
          <div
            style={{
              borderRadius: 16,
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(148,163,184,0.4)",
              padding: 10,
              minHeight: 260,
              height: "65vh",
              maxHeight: "65vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {selectedConv ? (
              <>
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(31,41,55,0.9)",
                    paddingBottom: 6,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {(() => {
                      const avatarProfile =
                        getAvatarForConversation(selectedConv);
                      const displayName =
                        getDisplayNameForConversation(selectedConv);
                      const initials = getInitials(
                        avatarProfile
                          ? getProfileName(avatarProfile)
                          : displayName
                      );
                      return (
                        <>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "999px",
                              background:
                                "radial-gradient(circle at 30% 20%, #f97316, #4f46e5 55%, #020617)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                              fontSize: 13,
                              color: "#f9fafb",
                              fontWeight: 600,
                            }}
                          >
                            {avatarProfile?.avatar_url ? (
                              <img
                                src={avatarProfile.avatar_url}
                                alt="Avatar conversación"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div>
                            <div
                              style={{
                                margin: 0,
                                fontSize: 14,
                                color: "#e5e7eb",
                              }}
                            >
                              {displayName}
                            </div>
                            {selectedConv.title && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#9ca3af",
                                }}
                              >
                                {selectedConv.title}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteConversation}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      padding: "4px 10px",
                      fontSize: 11,
                      cursor: "pointer",
                      background: "#ef4444",
                      color: "#fff",
                    }}
                  >
                    Eliminar
                  </button>
                </div>

                {/* Lista de mensajes */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    paddingRight: 4,
                    marginBottom: 4,
                  }}
                >
                  {messages.length === 0 && (
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>
                      No hay mensajes todavía en esta conversación.
                    </p>
                  )}

                  {messages.map((msg) => {
                    const isMine = msg.sender_id === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMine ? "flex-end" : "flex-start",
                          maxWidth: "70%",
                          borderRadius: 14,
                          padding: "6px 10px",
                          fontSize: 13,
                          background: isMine
                            ? "linear-gradient(90deg,#4f46e5,#a855f7)"
                            : "rgba(31,41,55,0.95)",
                          color: "#f9fafb",
                        }}
                      >
                        <div>{msg.content}</div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 10,
                            opacity: 0.7,
                            textAlign: "right",
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>

                {/* Indicador "está escribiendo..." */}
                {typingUserIds.length > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      marginBottom: 4,
                      paddingLeft: 4,
                    }}
                  >
                    {renderTypingText()}
                  </div>
                )}

                {/* Caja de texto */}
                <form onSubmit={handleSend} style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={handleInputChange}
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      border: "1px solid rgba(55,65,81,0.9)",
                      background: "#020617",
                      color: "#e5e7eb",
                      padding: "6px 10px",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      borderRadius: 999,
                      border: "none",
                      padding: "6px 16px",
                      fontSize: 13,
                      cursor: "pointer",
                      background:
                        "linear-gradient(90deg,#22c55e,#4ade80,#a3e635)",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  >
                    Enviar
                  </button>
                </form>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                Selecciona una conversación a la izquierda o crea una de
                prueba.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Messages;
