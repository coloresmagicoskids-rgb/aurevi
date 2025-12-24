// src/screens/Messages.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

import ConversationsList from "../sections/MessagesPanel/ConversationsList.jsx";
import ChatWindow from "../sections/MessagesPanel/ChatWindow.jsx";
import UserSearchModal from "../sections/MessagesPanel/UserSearchModal.jsx"; // ✅ NUEVO

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

  const [messagesRaw, setMessagesRaw] = useState([]); // mensajes como vienen del service
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [unreadByConv, setUnreadByConv] = useState({});
  const [typingUserIds, setTypingUserIds] = useState([]);

  const [searchOpen, setSearchOpen] = useState(false); // ✅ NUEVO (solo una vez)

  const typingTimeoutRef = useRef(null);

  // Helpers (tus mismos)
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

  // ---------- INIT: usuario + conversaciones ----------
  useEffect(() => {
  const init = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const user = await getCurrentUser();
      if (!user) {
        setErrorMsg("Necesitas iniciar sesión para usar los mensajes.");
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      // ✅ AQUÍ VA TU BLOQUE
      try {
        const convos = await fetchConversationsForUser(user.id);
        setConversations(convos);
        setSelectedConv(convos?.[0] || null);
      } catch (err) {
        console.error("fetchConversationsForUser ERROR =>", err);
        setErrorMsg(
          "Error cargando tus conversaciones: " +
            (err?.message || "desconocido")
        );
      }
	  
	  const { data: convId, error } = await supabase.rpc("get_or_create_dm", {
  other_user: picked.id,
});


    } catch (err) {
      console.error("INIT ERROR =>", err);
      setErrorMsg("Error inicializando mensajes.");
    } finally {
      setLoading(false);
    }
  };

  init();
}, []);
  // ---------- Miembros ----------
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
        console.error("Error cargando miembros:", err);
      }
    };
    loadMembers();
  }, [currentUser, conversations]);

  // ---------- Unread ----------
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
        console.error("Error cargando unread:", err);
      }
    };
    loadUnread();
  }, [currentUser, conversations]);

  // ---------- Mensajes (cuando cambias conv) ----------
  useEffect(() => {
    const loadMsgs = async () => {
      if (!selectedConv) {
        setMessagesRaw([]);
        return;
      }
      try {
        const msgs = await fetchMessages(selectedConv.id);
        setMessagesRaw(msgs);
      } catch (err) {
        console.error(err);
        setErrorMsg("Error cargando mensajes.");
      }
    };
    loadMsgs();
  }, [selectedConv]);

  // ---------- Realtime: escuchar nuevos mensajes de la conversación activa ----------
  useEffect(() => {
    if (!selectedConv) return;

    const channel = supabase
      .channel(`messages:${selectedConv.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConv.id}`,
        },
        (payload) => {
          const newMsg = payload.new;

          // ✅ aquí era el bug: en este archivo NO existe setMessages, es setMessagesRaw
          setMessagesRaw((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv]);

  // ---------- Polling typing ----------
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
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedConv, currentUser]);

  // ---------- UI: seleccionar conversación ----------
  const handleSelectConversation = async (conv) => {
    setSelectedConv(conv);
    if (!currentUser) return;

    try {
      await markConversationRead(conv.id, currentUser.id);
      setUnreadByConv((prev) => ({ ...prev, [conv.id]: 0 }));
    } catch (err) {
      console.error("Error mark read:", err);
    }
  };

  // ---------- Enviar (lo usa MessageInput -> ChatWindow) ----------
  const handleSendText = async (text) => {
    if (!text?.trim() || !currentUser || !selectedConv) return;

    try {
      setErrorMsg("");

      // enviar real por service
      const msg = await sendMessage({
        conversationId: selectedConv.id,
        senderId: currentUser.id,
        content: text.trim(),
      });

      // lo agregamos al estado
      setMessagesRaw((prev) => [...prev, msg]);

      // dejar de escribir
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

  // ---------- NUEVO: abrir modal (botón + Nuevo) ----------
  const handleNewConversation = () => {
    if (!currentUser) return;
    setSearchOpen(true);
  };

  // ---------- NUEVO: al escoger un usuario del modal ----------
  const handlePickUser = async (u) => {
    if (!currentUser || !u?.id) return;

    try {
      setErrorMsg("");

      // ✅ crea/abre conversación DM con ambos miembros
      // Nota: si tu service NO evita duplicados, luego lo cambiamos a RPC get_or_create_dm.
      const convId = await createConversation({
        title: "", // DM no necesita título; el header lo saca del "otro"
        memberIds: [currentUser.id, u.id],
      });

      // refrescar convos
      const convos = await fetchConversationsForUser(currentUser.id);
      setConversations(convos);

      const found = convos.find((c) => c.id === convId);
      if (found) setSelectedConv(found);
    } catch (err) {
      console.error(err);
      setErrorMsg("No se pudo abrir el chat con ese usuario.");
    }
  };

  // ---------- Adaptadores: tu data -> UI nueva ----------
  const uiConversations = useMemo(() => {
    return (conversations || []).map((c) => ({
      id: c.id,
      title: getDisplayNameForConversation(c),
      unreadCount: unreadByConv[c.id] || 0,
      lastMessage: c.last_message ? { text: c.last_message } : { text: "" },
      _raw: c,
    }));
  }, [conversations, unreadByConv, membersByConv, currentUser]);

  // ✅ uiActiveConv: DM -> nombre/avatar del otro, Grupo -> título
  const uiActiveConv = useMemo(() => {
    if (!selectedConv) return null;

    const members = membersByConv[selectedConv.id] || [];
    const others = currentUser
      ? members.filter((m) => m.id !== currentUser.id)
      : members;

    const isDM = others.length === 1;

    const dmName = isDM ? getProfileName(others[0]) : null;
    const dmAvatar = isDM
      ? others[0]?.avatar_url ||
        others[0]?.profile?.avatar_url ||
        others[0]?.profiles?.avatar_url ||
        null
      : null;

    const groupTitle =
      selectedConv.title && selectedConv.title.trim()
        ? selectedConv.title.trim()
        : `Grupo (${members.length || 0})`;

    const headerName = isDM ? dmName : groupTitle;

    const headerSubtitle = isDM
      ? "Chat directo"
      : `${members.length || 0} participantes`;

    return {
      id: selectedConv.id,
      title: headerName,
      _raw: selectedConv,
      typingText: typingUserIds.length > 0 ? "Alguien está escribiendo…" : "",
      headerName,
      headerAvatar: dmAvatar,
      headerSubtitle,
    };
  }, [selectedConv, membersByConv, currentUser, typingUserIds]);

  const uiMessages = useMemo(() => {
    return (messagesRaw || []).map((m) => ({
      id: m.id,
      text: m.content ?? "",
      senderId: m.sender_id,
      createdAt: m.created_at,
      _raw: m,
    }));
  }, [messagesRaw]);

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
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 2.05fr)",
              gap: 12,
              marginTop: 12,
              height: "65vh",
            }}
          >
            <ConversationsList
              conversations={uiConversations}
              activeId={selectedConv?.id || null}
              onSelect={(uiConv) => handleSelectConversation(uiConv._raw)}
              onNew={handleNewConversation} // ✅ ABRE MODAL
            />

            <ChatWindow
              conversation={uiActiveConv}
              messages={uiMessages}
              currentUserId={currentUser.id}
              onSend={handleSendText}
            />
          </div>

          {/* ✅ MODAL */}
          <UserSearchModal
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            currentUserId={currentUser?.id}
            onPickUser={handlePickUser}
          />
        </>
      )}
    </section>
  );
}

export default Messages;