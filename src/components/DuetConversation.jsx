// src/components/DuetConversation.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function DuetConversation({ baseVideo }) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const groupId = baseVideo?.duet_group_id || null;

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const loadDuet = async () => {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("videos")
        .select("*") // incluye duet_group_id, duet_step si existen
        .eq("duet_group_id", groupId);

      if (error) {
        console.error("Error cargando clips de dueto:", error);
        setErrorMsg("No se pudieron cargar los clips del dueto.");
        setLoading(false);
        return;
      }

      const list = data || [];

      // Ordenar primero por duet_step (A/B), luego por created_at
      list.sort((a, b) => {
        const stepOrder = { A: 0, B: 1 };
        const aStep = stepOrder[a.duet_step] ?? 99;
        const bStep = stepOrder[b.duet_step] ?? 99;
        if (aStep !== bStep) return aStep - bStep;

        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return aDate - bDate;
      });

      setClips(list);
      setLoading(false);
    };

    loadDuet();
  }, [groupId]);

  if (!groupId) {
    // Este video no es parte de un dueto, no dibujamos nada extra
    return null;
  }

  return (
    <div className="aurevi-form-card">
      <h3
        style={{
          marginTop: 0,
          fontSize: 15,
          color: "#f9fafb",
        }}
      >
        Dueto emocional
      </h3>

      {loading && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          Cargando clips del dueto...
        </p>
      )}

      {errorMsg && (
        <p style={{ fontSize: 12, color: "#fca5a5" }}>{errorMsg}</p>
      )}

      {!loading && !errorMsg && clips.length <= 1 && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          Este clip todavía no tiene su “respuesta”. Cuando grabes la segunda
          parte con el mismo dueto, aparecerá aquí como conversación.
        </p>
      )}

      {clips.length > 1 && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {clips.map((clip) => {
            const label =
              clip.duet_step === "A"
                ? "Primera versión"
                : clip.duet_step === "B"
                ? "Respuesta"
                : "Clip del dueto";

            return (
              <div
                key={clip.id}
                style={{
                  borderRadius: 14,
                  padding: 8,
                  background: "rgba(15,23,42,0.9)",
                  border: "1px solid rgba(148,163,184,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {label}
                </div>
                <video
                  src={clip.video_url}
                  controls
                  className="aurevi-video-player"
                  style={{ maxHeight: 260 }}
                />
                {clip.title && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#e5e7eb",
                      marginTop: 2,
                    }}
                  >
                    {clip.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DuetConversation;