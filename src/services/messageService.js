// src/services/messageService.js
import { supabase } from "../supabaseClient";

/**
 * Devuelve el usuario actual autenticado
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
}

/**
 * Obtiene todas las conversaciones donde participa el usuario.
 * (solo datos básicos de la conversación)
 */
export async function fetchConversationsForUser(userId) {
  if (!userId) return [];

  const { data: memberRows, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (memberError) throw memberError;

  const ids = Array.from(
    new Set((memberRows || []).map((row) => row.conversation_id).filter(Boolean))
  );

  if (ids.length === 0) return [];

  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (convError) throw convError;

  return conversations || [];
}

/**
 * Obtiene LOS PERFILES de los miembros de varias conversaciones.
 * Devuelve un mapa: { [conversation_id]: [profiles...] }
 */
export async function fetchMembersForConversations(conversationIds) {
  if (!conversationIds || conversationIds.length === 0) {
    return {};
  }

  const { data: memberRows, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("conversation_id", conversationIds);

  if (memberError) throw memberError;
  if (!memberRows || memberRows.length === 0) return {};

  const userIds = Array.from(
    new Set(memberRows.map((row) => row.user_id).filter(Boolean))
  );

  if (userIds.length === 0) return {};

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileById = {};
  (profiles || []).forEach((p) => {
    profileById[p.id] = p;
  });

  const map = {};
  memberRows.forEach((row) => {
    const p = profileById[row.user_id];
    if (!p) return;
    if (!map[row.conversation_id]) {
      map[row.conversation_id] = [];
    }
    map[row.conversation_id].push(p);
  });

  return map;
}

/**
 * Crea una conversación nueva y registra a los miembros
 */
export async function createConversation({ title, memberIds }) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      title: title || null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const conversationId = data.id;

  const members = (memberIds || []).map((uid) => ({
    conversation_id: conversationId,
    user_id: uid,
  }));

  if (members.length > 0) {
    const { error: membersError } = await supabase
      .from("conversation_members")
      .insert(members);

    if (membersError) throw membersError;
  }

  return conversationId;
}

/**
 * Obtiene los mensajes de una conversación
 */
export async function fetchMessages(conversationId) {
  if (!conversationId) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Envía un mensaje
 */
export async function sendMessage({ conversationId, senderId, content }) {
  if (!conversationId || !senderId || !content?.trim()) return null;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/* ============================
   CONTADORES DE NO LEÍDOS
   ============================ */

/**
 * Calcula cuántos mensajes no leídos tiene el usuario en cada conversación
 * Devuelve: { [conversation_id]: count }
 */
export async function fetchUnreadCountsForUser(userId, conversationIds) {
  if (!userId || !conversationIds?.length) return {};

  const { data: members, error: membersError } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds);

  if (membersError) throw membersError;

  const lastReadMap = {};
  (members || []).forEach((m) => {
    lastReadMap[m.conversation_id] = m.last_read_at;
  });

  const { data: msgs, error: msgsError } = await supabase
    .from("messages")
    .select("conversation_id, created_at")
    .in("conversation_id", conversationIds);

  if (msgsError) throw msgsError;

  const unreadMap = {};
  (msgs || []).forEach((m) => {
    const lastRead = lastReadMap[m.conversation_id];
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
    }
  });

  return unreadMap;
}

/**
 * Marca una conversación como leída para un usuario
 */
export async function markConversationRead(conversationId, userId) {
  if (!conversationId || !userId) return;

  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}

/* ============================
   INDICADOR "ESTÁ ESCRIBIENDO…"
   ============================ */

/**
 * Marca en messages_typing si un usuario está escribiendo o no
 */
export async function setTypingStatus({ conversationId, userId, isTyping }) {
  if (!conversationId || !userId) return;

  const { error } = await supabase
    .from("messages_typing")
    .upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        is_typing: !!isTyping,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,user_id" }
    );

  if (error) throw error;
}

/**
 * Devuelve los IDs de usuarios (distintos a currentUserId)
 * que están escribiendo recientemente en esa conversación
 */
export async function fetchTypingUsers(conversationId, currentUserId) {
  if (!conversationId) return [];

  const now = new Date();
  const cutoff = new Date(now.getTime() - 1000 * 10); // últimos 10 segundos

  const { data, error } = await supabase
    .from("messages_typing")
    .select("user_id, updated_at, is_typing")
    .eq("conversation_id", conversationId)
    .eq("is_typing", true)
    .gt("updated_at", cutoff.toISOString());

  if (error) throw error;

  return (data || [])
    .map((r) => r.user_id)
    .filter((id) => id !== currentUserId);
}
