// src/screens/Messages.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

import ConversationsList from "../sections/MessagesPanel/ConversationsList.jsx";
import ChatWindow from "../sections/MessagesPanel/ChatWindow.jsx";
import UserSearchModal from "../sections/MessagesPanel/UserSearchModal.jsx";

import { usePresence } from "../hooks/usePresence";

import {
  getCurrentUser,
  fetchConversationsForUser,
  fetchMessages,
  sendMessage,
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

  const [messagesRaw, setMessagesRaw] = useState([]);
  const messagesRef = useRef([]);
  const selectedConvRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messagesRaw || [];
  }, [messagesRaw]);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [unreadByConv, setUnreadByConv] = useState({});
  const [typingUserIds, setTypingUserIds] = useState([]);

  const [searchOpen, setSearchOpen] = useState(false);

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

  // ==================================================
  // ✅ Presence: juntar TODOS los otherUserIds (lista + header)
  // ==================================================
  const otherUserIds = useMemo(() => {
    if (!currentUser) return [];
    const set = new Set();

    for (const conv of conversations || []) {
      const members = membersByConv[conv.id] || [];
      for (const m of members) {
        if (m?.id && m.id !== currentUser.id) set.add(m.id);
      }
    }
    return Array.from(set);
  }, [currentUser, conversations, membersByConv]);

  const presence = usePresence(otherUserIds);

  // ==================================================
  // ✅ Read receipts: marcar leído hasta el último msg de esa conv
  // ==================================================
  const markReadUpTo = useCallback(
    async (convId, msgs = []) => {
      if (!currentUser?.id || !convId) return;

      const lastId = msgs?.[msgs.length - 1]?.id;
      if (!lastId) return;

      try {
        const { error } = await supabase.rpc("mark_conversation_read", {
          p_conversation_id: convId,
          p_last_message_id: lastId,
        });
        if (error) throw error;

        setUnreadByConv((prev) => ({ ...prev, [convId]: 0 }));
        return;
      } catch (e) {
        // fallback legacy
        try {
          await markConversationRead(convId, currentUser.id);
          setUnreadByConv((prev) => ({ ...prev, [convId]: 0 }));
        } catch (e2) {
          console.warn("[reads] No se pudo marcar leído:", e2);
        }
      }
    },
    [currentUser?.id]
  );

  // ==================================================
  // ✅ Reload convos (botón ↻)
  // ==================================================
  const reloadConversations = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const convos = await fetchConversationsForUser(currentUser.id);
      setConversations(convos || []);

      if (selectedConvRef.current?.id) {
        const still = (convos || []).find((c) => c.id === selectedConvRef.current.id);
        if (!still) setSelectedConv((convos || [])?.[0] || null);
      }
    } catch (e) {
      console.warn("reloadConversations falló:", e);
    }
  }, [currentUser?.id]);

  // ---------- INIT: usuario + conversaciones ----------
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const user = await getCurrentUser();
        if (!user) {
          setErrorMsg("Necesitas iniciar sesión para usar los mensajes.");
          return;
        }

        setCurrentUser(user);

        const convos = await fetchConversationsForUser(user.id);
        setConversations(convos || []);
        setSelectedConv((convos || [])?.[0] || null);
      } catch (err) {
        console.error("INIT ERROR =>", err);
        setErrorMsg(
          "Error cargando tus conversaciones: " + (err?.message || "desconocido")
        );
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
      if (!selectedConv?.id) {
        setMessagesRaw([]);
        return;
      }
      try {
        const msgs = await fetchMessages(selectedConv.id);
        setMessagesRaw(msgs || []);
        await markReadUpTo(selectedConv.id, msgs || []);
      } catch (err) {
        console.error(err);
        setErrorMsg("Error cargando mensajes.");
      }
    };
    loadMsgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConv?.id]);

  // ==================================================
  // ✅ Realtime GLOBAL: TODOS mis chats (WhatsApp feeling)
  // - Actualiza chat abierto
  // - Incrementa unread en chats no abiertos
  // - Actualiza lista y la sube al tope
  // ==================================================
  const convIdsKey = useMemo(() => {
    return (conversations || [])
      .map((c) => c.id)
      .filter(Boolean)
      .join(",");
  }, [conversations]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const convIds = (conversations || []).map((c) => c.id).filter(Boolean);
    if (!convIds.length) return;

    const inFilter = `conversation_id=in.(${convIds.join(",")})`;

    const channel = supabase
      .channel(`messages_global:${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: inFilter },
        async (payload) => {
          const newMsg = payload.new;
          if (!newMsg?.conversation_id) return;

          const convId = newMsg.conversation_id;
          const isMine = newMsg.sender_id === currentUser.id;
          const activeId = selectedConvRef.current?.id;
          const isActive = activeId === convId;

          // 1) Si es el chat abierto: agregar al hilo en pantalla
          if (isActive) {
            setMessagesRaw((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // si NO es mío, lo marco leído
            if (!isMine) {
              const next = [...(messagesRef.current || []), newMsg];
              await markReadUpTo(convId, next);
            }
          } else {
            // 2) Si NO es el chat abierto: subir unread instantáneo
            if (!isMine) {
              setUnreadByConv((prev) => ({
                ...prev,
                [convId]: (prev[convId] || 0) + 1,
              }));
            }
          }

          // 3) Actualiza lista (último mensaje/fecha) y súbela al tope
          setConversations((prev) => {
            const list = prev || [];
            const idx = list.findIndex((c) => c.id === convId);
            if (idx === -1) return list;

            const updated = {
              ...list[idx],
              last_message: newMsg.content ?? "",
              last_message_at: newMsg.created_at,
              updated_at: newMsg.created_at,
            };

            const without = [...list.slice(0, idx), ...list.slice(idx + 1)];
            return [updated, ...without];
          });
        }
      )
      .subscribe((status) => {
        console.log("[realtime global] status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, convIdsKey, markReadUpTo]); // ✅ sin selectedConv para evitar resuscripciones

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
  const handleSelectConversation = async (uiConv) => {
    const conv = uiConv?._raw || uiConv;
    if (!conv?.id) return;

    setSelectedConv(conv);

    // optimista: al entrar, unread 0; loadMsgs/markReadUpTo lo confirma
    setUnreadByConv((prev) => ({ ...prev, [conv.id]: 0 }));
  };

  // ---------- Enviar ----------
  const handleSendText = async (text) => {
    if (!text?.trim() || !currentUser || !selectedConv) return;

    try {
      setErrorMsg("");

      const msg = await sendMessage({
        conversationId: selectedConv.id,
        senderId: currentUser.id,
        content: text.trim(),
      });

      setMessagesRaw((prev) => [...prev, msg]);

      setTypingStatus({
        conversationId: selectedConv.id,
        userId: currentUser.id,
        isTyping: false,
      }).catch(() => {});

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const next = [...(messagesRef.current || []), msg];
      await markReadUpTo(selectedConv.id, next);

      // Empuja último mensaje inmediato + mueve al tope
      setConversations((prev) => {
        const list = prev || [];
        const idx = list.findIndex((c) => c.id === selectedConv.id);
        if (idx === -1) return list;

        const updated = {
          ...list[idx],
          last_message: msg.content ?? "",
          last_message_at: msg.created_at,
          updated_at: msg.created_at,
        };

        const without = [...list.slice(0, idx), ...list.slice(idx + 1)];
        return [updated, ...without];
      });
    } catch (err) {
      console.error(err);
      setErrorMsg("No se pudo enviar el mensaje.");
    }
  };

  // ---------- Abrir modal ----------
  const handleNewConversation = () => {
    if (!currentUser) return;
    setSearchOpen(true);
  };

  // ---------- Al escoger un usuario del modal ----------
  const handlePickUser = async (u) => {
    if (!currentUser || !u?.id) return;

    try {
      setErrorMsg("");

      const { data: convId, error: rpcErr } = await supabase.rpc(
        "get_or_create_dm",
        { other_user: u.id }
      );
      if (rpcErr) throw rpcErr;

      const convos = await fetchConversationsForUser(currentUser.id);
      setConversations(convos || []);

      const found = (convos || []).find((c) => c.id === convId);
      if (found) setSelectedConv(found);

      setSearchOpen(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "No se pudo abrir el chat con ese usuario: " + (err?.message || "")
      );
    }
  };

  // ---------- Adaptadores: data -> UI ----------
  const uiConversations = useMemo(() => {
    const list = (conversations || []).map((c) => {
      const members = membersByConv[c.id] || [];
      const others = currentUser
        ? members.filter((m) => m.id !== currentUser.id)
        : members;

      const dmOtherId = others.length === 1 ? others[0]?.id : null;
      const dmOnline = dmOtherId ? !!presence?.[dmOtherId]?.is_online : false;

      return {
        id: c.id,
        title: getDisplayNameForConversation(c),
        unreadCount: unreadByConv[c.id] || 0,
        lastMessage: c.last_message ? { text: c.last_message } : { text: "" },
        isOnline: dmOnline,
        _raw: c,
      };
    });

    // Orden WhatsApp (más reciente arriba)
    list.sort((a, b) => {
      const ar = a?._raw || {};
      const br = b?._raw || {};
      const at =
        ar.last_message_at ||
        ar.last_message_created_at ||
        ar.updated_at ||
        ar.created_at ||
        0;
      const bt =
        br.last_message_at ||
        br.last_message_created_at ||
        br.updated_at ||
        br.created_at ||
        0;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

    return list;
  }, [conversations, unreadByConv, membersByConv, currentUser, presence]);

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

    const dmOtherId = isDM ? others[0]?.id : null;
    const dmOnline = dmOtherId ? !!presence?.[dmOtherId]?.is_online : false;

    const headerSubtitle = isDM
      ? dmOnline
        ? "En línea"
        : "Chat directo"
      : `${members.length || 0} participantes`;

    return {
      id: selectedConv.id,
      title: headerName,
      _raw: selectedConv,
      typingText: typingUserIds.length > 0 ? "Alguien está escribiendo…" : "",
      headerName,
      headerAvatar: dmAvatar,
      headerSubtitle,
      isOnline: dmOnline,
    };
  }, [selectedConv, membersByConv, currentUser, typingUserIds, presence]);

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
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onReload={reloadConversations}
              presence={presence}
            />

            <ChatWindow
              conversation={uiActiveConv}
              messages={uiMessages}
              currentUserId={currentUser.id}
              onSend={handleSendText}
              presence={presence}
            />
          </div>

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