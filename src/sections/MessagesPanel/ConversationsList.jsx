// ConversationsList.jsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient"; // ✅ Ajusta esta ruta si tu supabaseClient está en otro lugar
import ConversationItem from "./ConversationItem.jsx";

export default function ConversationsList({
  conversations: conversationsProp = [],
  activeId = null,
  onSelect = () => {},
  onNew = () => {}, // ✅ ahora abre el modal real
}) {
  // ✅ Si te pasan conversaciones por props, seguimos soportándolo.
  // ✅ Si no te pasan nada, cargamos desde Supabase aquí.
  const [conversations, setConversations] = useState(conversationsProp);
  const [loading, setLoading] = useState(false);

  // Mantener sync si el padre aún maneja conversaciones
  useEffect(() => {
    setConversations(conversationsProp || []);
  }, [conversationsProp]);

  const loadConversations = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("conversations")
      .select(
        `
        id,
        updated_at,
        conversation_members (
          user_id,
          profiles (
            username,
            avatar_url
          )
        )
      `
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error cargando conversaciones:", error);
      setLoading(false);
      return;
    }

    setConversations(data || []);
    setLoading(false);
  }, []);

  // ✅ Auto-cargar solo si NO te están pasando conversaciones desde arriba
  useEffect(() => {
    if ((conversationsProp || []).length === 0) {
      loadConversations();
    }
  }, [conversationsProp, loadConversations]);

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
          <button
            onClick={loadConversations}
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
              conversation={c}
              active={c.id === activeId}
              onClick={() => onSelect(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}