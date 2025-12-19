// src/components/CommentsPanel.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function CommentsPanel({ videoId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cargar comentarios del video
  useEffect(() => {
    if (!videoId) return;

    async function fetchComments() {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error cargando comentarios:", error);
        setErrorMsg("No se pudieron cargar los comentarios.");
      } else {
        setComments(data || []);
      }

      setLoading(false);
    }

    fetchComments();
  }, [videoId]);

  // Enviar nuevo comentario
  const handleSendComment = async (e) => {
    e?.preventDefault?.();
    setErrorMsg("");

    const content = newComment.trim();
    if (!content) return;

    setSending(true);

    // Verificar usuario actual
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error obteniendo usuario:", userError);
    }

    if (!user) {
      setErrorMsg("Debes iniciar sesión para comentar.");
      setSending(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          video_id: videoId,
          user_id: user.id,
          content,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Error guardando comentario:", error);
        setErrorMsg("No se pudo guardar el comentario.");
      } else if (data) {
        // Añadir al inicio de la lista (optimista)
        setComments((prev) => [data, ...prev]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Error inesperado al comentar:", err);
      setErrorMsg("Ocurrió un error inesperado al comentar.");
    }

    setSending(false);
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return "";
    }
  };

  return (
    <div className="aurevi-comments-shell">
      {/* Formulario para escribir comentario */}
      <form onSubmit={handleSendComment} className="aurevi-comments-form">
        <textarea
          className="aurevi-textarea"
          rows={2}
          placeholder="Escribe un comentario bonito ✨"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <div className="aurevi-comments-actions">
          {errorMsg && (
            <span className="aurevi-comments-error">{errorMsg}</span>
          )}
          <button
            type="submit"
            className="aurevi-primary-btn aurevi-comments-send-btn"
            disabled={sending || !newComment.trim()}
          >
            {sending ? "Enviando..." : "Comentar"}
          </button>
        </div>
      </form>

      {/* Lista de comentarios */}
      <div className="aurevi-comments-list">
        {loading && (
          <p className="aurevi-comments-helper">Cargando comentarios...</p>
        )}

        {!loading && comments.length === 0 && (
          <p className="aurevi-comments-helper">
            Sé la primera persona en comentar este video 🌟
          </p>
        )}

        {comments.map((c) => (
          <div key={c.id} className="aurevi-comment-item">
            <div className="aurevi-comment-avatar">
              {/* Placeholder simple por ahora */}
              <span className="aurevi-comment-avatar-fallback">C</span>
            </div>
            <div className="aurevi-comment-body">
              <div className="aurevi-comment-header">
                <span className="aurevi-comment-author">
                  Creador de AUREVI
                </span>
                <span className="aurevi-comment-date">
                  {formatDate(c.created_at)}
                </span>
              </div>
              <p className="aurevi-comment-text">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CommentsPanel;