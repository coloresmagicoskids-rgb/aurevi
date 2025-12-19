// src/screens/WatchVideo.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useWorld } from "../worlds/WorldContext";
import { WORLD_LABELS } from "../worlds/worldTypes";

function WatchVideo({ videoId, navigate }) {
  const { activeWorld, setActiveWorld } = useWorld();

  const [video, setVideo] = useState(null);
  const [duetVideos, setDuetVideos] = useState([]); // A + B (si existen)
  const [loading, setLoading] = useState(true);
  const [duetLoading, setDuetLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Estado para el análisis IA (video_analysis)
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    if (!videoId) {
      setErrorMsg("No se encontró el video que quieres ver.");
      setLoading(false);
      return;
    }

    const loadVideoAnalysis = async (id) => {
      try {
        setAnalysisLoading(true);
        setAnalysisError("");
        setAnalysis(null);

        const { data, error } = await supabase
          .from("video_analysis")
          .select(
            "mood_detected, emotion, clarity, narrative_quality, creativity_score, advice, created_at"
          )
          .eq("video_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error cargando análisis IA:", error);
          setAnalysisError("No se pudo cargar el análisis IA de este video.");
        } else if (data) {
          setAnalysis(data);
        }
      } catch (err) {
        console.error("Error inesperado al cargar análisis IA:", err);
        setAnalysisError("Ocurrió un error al leer el análisis IA.");
      } finally {
        setAnalysisLoading(false);
      }
    };

    const loadVideoAndDuet = async () => {
      setLoading(true);
      setErrorMsg("");
      setDuetVideos([]);

      // 1) Cargar el video base
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", videoId)
        .maybeSingle();

      if (error) {
        console.error("Error cargando video en WatchVideo:", error);
        setErrorMsg("No se pudo cargar este video.");
        setLoading(false);
        return;
      }

      setVideo(data);
      setLoading(false);

      // 2) Si este video pertenece a un dueto, cargamos el resto del grupo
      if (data && data.duet_group_id) {
        setDuetLoading(true);
        const { data: duetList, error: duetError } = await supabase
          .from("videos")
          .select("*")
          .eq("duet_group_id", data.duet_group_id)
          .order("created_at", { ascending: true });

        if (duetError) {
          console.error("Error cargando videos del dueto:", duetError);
        } else {
          setDuetVideos(duetList || []);
        }
        setDuetLoading(false);
      }

      // 3) Cargar el análisis IA (si existe) para este video
      await loadVideoAnalysis(videoId);
    };

    loadVideoAndDuet();
  }, [videoId]);

  // ---- Helpers ----

  const renderDuetLabel = (step) => {
    if (step === "A") return "Parte A (tú de hoy)";
    if (step === "B") return "Parte B (tú del futuro)";
    return "Parte del dueto";
  };

  const isPartOfDuet = !!video?.duet_group_id;
  const hasFullDuet = duetVideos.length >= 2;

  // Helper para traducir el mood a algo bonito
  const renderMoodLabel = (mood) => {
    if (!mood) return "No detectado";
    const map = {
      suave: "Suave / tranquilo",
      intenso: "Intenso",
      introspectivo: "Introspectivo",
      jugueton: "Juguetón",
      terapeutico: "Terapéutico",
    };
    return map[mood] || mood;
  };

  // Helper para barritas 1–5
  const renderScoreBar = (score) => {
    if (score == null) return null;
    const safeScore = Math.max(1, Math.min(5, Number(score) || 1));
    const segments = Array.from({ length: 5 }, (_, i) => i < safeScore);

    return (
      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 4,
        }}
      >
        {segments.map((active, idx) => (
          <span
            key={idx}
            style={{
              width: 12,
              height: 6,
              borderRadius: 999,
              background: active
                ? "linear-gradient(90deg,#4ade80,#22c55e)"
                : "rgba(55,65,81,0.9)",
            }}
          ></span>
        ))}
      </div>
    );
  };

  // Datos de mundo del video
  const videoWorldKey = video?.world_type || "publico";
  const videoWorldLabel = WORLD_LABELS[videoWorldKey] || "Mundo público";
  const activeWorldLabel = WORLD_LABELS[activeWorld] || activeWorld;

  return (
    <section className="aurevi-screen">
      <h2 className="aurevi-screen-title">Ver video</h2>

      {/* MINI PANEL DE MUNDO / MENÚ CONTEXTUAL */}
      <div
        className="aurevi-feed-card"
        style={{
          marginBottom: 12,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 12,
        }}
      >
        <div>
          <span style={{ opacity: 0.8 }}>Mundo actual de navegación: </span>
          <strong>{activeWorldLabel}</strong>
        </div>

        {video && (
          <>
            <div>
              <span style={{ opacity: 0.8 }}>Este video pertenece a: </span>
              <strong>{videoWorldLabel}</strong>
            </div>

            {/* Botón para cambiar el mundo activo al del video */}
            <button
              type="button"
              onClick={() => setActiveWorld(videoWorldKey)}
              style={{
                marginTop: 4,
                alignSelf: "flex-start",
                border: "none",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
                background:
                  "linear-gradient(90deg,#4f46e5,#7c3aed,#ec4899,#f97316)",
                color: "#f9fafb",
              }}
            >
              Ver AUREVI en este mundo
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        className="aurevi-primary-btn"
        style={{ marginBottom: 12, fontSize: 13 }}
        onClick={() => navigate("home")}
      >
        ? Volver al inicio
      </button>

      {loading && <p style={{ color: "#9ca3af" }}>Cargando video...</p>}

      {errorMsg && (
        <p style={{ color: "#fca5a5", marginTop: 8 }}>{errorMsg}</p>
      )}

      {/* Video base */}
      {video && (
        <div className="aurevi-form-card" style={{ marginBottom: 16 }}>
          <video
            src={video.video_url}
            controls
            className="aurevi-video-player"
            style={{ maxHeight: 360 }}
          />
          <h3
            style={{
              marginTop: 8,
              fontSize: 16,
              color: "#f9fafb",
            }}
          >
            {video.title || "Video sin título"}
          </h3>

          {video.description && (
            <p
              style={{
                fontSize: 13,
                color: "#d1d5db",
                marginTop: 4,
              }}
            >
              {video.description}
            </p>
          )}

          {/* Mini menú de datos del video */}
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "#9ca3af",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span>?? {video.likes ?? 0} me gusta</span>
            <span>??? {video.views ?? 0} vistas</span>
            {video.category && <span>?? Categoría: {video.category}</span>}
            <span>
              ?? Creado:{" "}
              {video.created_at
                ? new Date(video.created_at).toLocaleString()
                : "—"}
            </span>
            <span>?? Mundo: {videoWorldLabel}</span>
          </div>

          {isPartOfDuet && (
            <p
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginTop: 6,
              }}
            >
              Este clip forma parte de un <strong>dueto emocional</strong>{" "}
              {video.duet_step ? `(Parte ${video.duet_step})` : ""}.
            </p>
          )}
        </div>
      )}

      {/* Panel de análisis IA (mentor creativo) */}
      {video && (
        <div className="aurevi-feed-card" style={{ marginBottom: 16 }}>
          <h3
            style={{
              marginTop: 0,
              fontSize: 14,
              marginBottom: 6,
            }}
          >
            Mentor creativo · Análisis IA
          </h3>

          {analysisLoading && (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>
              Leyendo el análisis de este video...
            </p>
          )}

          {analysisError && (
            <p style={{ fontSize: 12, color: "#fca5a5" }}>{analysisError}</p>
          )}

          {!analysisLoading && !analysisError && !analysis && (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>
              Aún no hay análisis guardado para este video. Los próximos clips
              que subas deberían comenzar a generar reportes aquí.
            </p>
          )}

          {!analysisLoading && analysis && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(15,23,42,0.9)",
                    color: "#e5e7eb",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Clima detectado: {renderMoodLabel(analysis.mood_detected)}
                </span>
                {analysis.emotion && (
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(30,64,175,0.75)",
                      color: "#e5e7eb",
                      fontSize: 11,
                    }}
                  >
                    Emoción: {analysis.emotion}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                  gap: 8,
                }}
              >
                <div>
                  <div>Claridad</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    Puntaje: {analysis.clarity ?? "—"} / 5
                  </div>
                  {renderScoreBar(analysis.clarity)}
                </div>
                <div>
                  <div>Narrativa</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    Puntaje: {analysis.narrative_quality ?? "—"} / 5
                  </div>
                  {renderScoreBar(analysis.narrative_quality)}
                </div>
                <div>
                  <div>Creatividad</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    Puntaje: {analysis.creativity_score ?? "—"} / 5
                  </div>
                  {renderScoreBar(analysis.creativity_score)}
                </div>
              </div>

              {analysis.advice && (
                <div style={{ marginTop: 6 }}>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      color: "#9ca3af",
                      marginBottom: 2,
                    }}
                  >
                    Recomendación del mentor
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#e5e7eb",
                      margin: 0,
                    }}
                  >
                    {analysis.advice}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bloque de conversación del dueto */}
      {isPartOfDuet && (
        <div className="aurevi-feed-card">
          <h3
            style={{
              marginTop: 0,
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            Conversación del dueto
          </h3>

          {duetLoading && (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>
              Cargando las otras partes de este dueto...
            </p>
          )}

          {!duetLoading && duetVideos.length === 0 && (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>
              Aún no encontramos otras partes de este dueto. Cuando grabes la
              otra mitad, aparecerá aquí.
            </p>
          )}

          {!duetLoading && duetVideos.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {duetVideos.map((clip) => (
                <div
                  key={clip.id}
                  style={{
                    display: "flex",
                    justifyContent:
                      clip.duet_step === "B" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      background:
                        clip.duet_step === "B"
                          ? "rgba(56,189,248,0.12)"
                          : "rgba(251,191,36,0.10)",
                      borderRadius: 14,
                      padding: 8,
                      border: "1px solid rgba(148,163,184,0.45)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: 11,
                        color: "#9ca3af",
                      }}
                    >
                      {renderDuetLabel(clip.duet_step)}
                    </p>
                    <video
                      src={clip.video_url}
                      controls
                      className="aurevi-video-player"
                      style={{ maxHeight: 220 }}
                    />
                    {clip.description && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#e5e7eb",
                        }}
                      >
                        {clip.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {hasFullDuet && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginTop: 4,
                  }}
                >
                  Estás viendo las dos partes de una mini conversación contigo
                  mismx. En el futuro esto podría mezclarse como un único
                  montaje.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default WatchVideo;