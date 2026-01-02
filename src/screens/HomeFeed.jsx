// src/screens/HomeFeed.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import CommentsPanel from "../components/CommentsPanel";
import VideoReactions from "../components/VideoReactions";
import { useWorld } from "../worlds/WorldContext";
import { WORLD_LABELS } from "../worlds/worldTypes";
import AdCard from "../components/ads/AdCard.jsx";

function HomeFeed() {
  const { activeWorld } = useWorld();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [viewedIds, setViewedIds] = useState(new Set());

  const [currentUser, setCurrentUser] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());

  // Modo del feed: todo o solo gente que sigo
  const [feedMode, setFeedMode] = useState("all"); // "all" | "following"

  // Perfil creativo–emocional del usuario que mira
  const [viewerMood, setViewerMood] = useState(""); // daily_mood
  const [viewerTrend, setViewerTrend] = useState(""); // creative_trend

  // Filtro de mood aplicado al feed
  const [moodFilterMode, setMoodFilterMode] = useState("none"); // "none" | "mood"

  // Perfiles de creadores (para avatar + badge)
  const [creatorProfiles, setCreatorProfiles] = useState({}); // id -> { avatar_url, creative_trend }

  // Análisis IA por video (mapa video_id -> análisis)
  const [analysisByVideo, setAnalysisByVideo] = useState({});

  // Misión creativa sugerida para el usuario actual
  const [personalMission, setPersonalMission] = useState(null);

  // Memoria de reacciones por video
  const [reactionsByVideo, setReactionsByVideo] = useState({});

  // Reacción predominante del usuario (para el algoritmo)
  const [topReaction, setTopReaction] = useState(null);

  // ----------------------------------------------------
  // ✅ Anuncios (MVP)
  // ----------------------------------------------------
  const AD_EVERY = 6; // 🔁 cambia esto si quieres (ej: 8, 10, etc.)

  const firstAd = {
  id: "ad-001",
  badge: "🤝 Apoyo creativo",
  title: "Edita más rápido tus videos",
  text: "Plantillas, cortes inteligentes y transiciones listas para creadores. Sin complicarte.",
  imageUrl: "/ads/ad-001.png",   // ✅ aquí
  ctaLabel: "Conocer",
  href: "https://example.com",
};

  // ----------------------------------------------------
  // Helper: mapear mood del usuario a categorías sugeridas
  // ----------------------------------------------------
  const moodToCategories = (mood) => {
    switch (mood) {
      case "energetico":
        return ["musica", "creatividad", "aprendizaje"];
      case "suave":
        return ["bienestar", "infantil", "otros"];
      case "introspectivo":
        return ["bienestar", "aprendizaje", "creatividad"];
      case "infantil":
        return ["infantil"];
      case "terapeutico":
        return ["bienestar", "musica", "otros"];
      default:
        return [];
    }
  };

  // mapear reacción favorita a categorías sugeridas
  const reactionToCategories = (reaction) => {
    switch (reaction) {
      case "calma":
        return ["bienestar", "infantil", "otros"];
      case "inspirado":
        return ["creatividad", "musica", "aprendizaje"];
      case "aprendi":
        return ["aprendizaje", "creatividad"];
      case "me_rei":
        return ["infantil", "musica", "otros"];
      case "me_ayudo":
        return ["bienestar", "aprendizaje", "otros"];
      default:
        return [];
    }
  };

  const recommendedCategories = Array.from(
    new Set([...moodToCategories(viewerMood), ...reactionToCategories(topReaction)])
  );

  // ----------------------------------------------------
  // Cargar usuario + follows + perfil emocional
  // ----------------------------------------------------
  useEffect(() => {
    async function loadUserAndFollows() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error obteniendo usuario:", error);
        return;
      }
      if (!data?.user) {
        setCurrentUser(null);
        setFollowingIds(new Set());
        setViewerMood("");
        setViewerTrend("");
        setTopReaction(null);
        return;
      }

      const user = data.user;
      setCurrentUser(user);

      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (followsError) {
        console.error("Error cargando follows:", followsError);
      } else {
        const ids = new Set((follows || []).map((f) => f.following_id));
        setFollowingIds(ids);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("daily_mood, creative_trend")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error cargando perfil emocional:", profileError);
      } else if (profile) {
        setViewerMood(profile.daily_mood || "");
        setViewerTrend(profile.creative_trend || "");
      }
    }

    loadUserAndFollows();
  }, []);

  // ----------------------------------------------------
  // Reacción predominante del usuario (VERSIÓN NUEVA SIN group())
  // ----------------------------------------------------
  useEffect(() => {
    async function loadTopReaction() {
      if (!currentUser) {
        setTopReaction(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("video_reactions")
          .select("reaction")
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("Error obteniendo reacción predominante:", error);
          setTopReaction(null);
          return;
        }

        if (!data || data.length === 0) {
          setTopReaction(null);
          return;
        }

        const counts = data.reduce((acc, row) => {
          if (!row.reaction) return acc;
          acc[row.reaction] = (acc[row.reaction] || 0) + 1;
          return acc;
        }, {});

        let top = null;
        let max = 0;
        for (const [reaction, count] of Object.entries(counts)) {
          if (count > max) {
            max = count;
            top = reaction;
          }
        }

        setTopReaction(top);
      } catch (err) {
        console.error("Error inesperado en loadTopReaction:", err);
        setTopReaction(null);
      }
    }

    loadTopReaction();
  }, [currentUser]);

  // ----------------------------------------------------
  // Cargar videos + perfiles de creadores (filtrando por mundo)
  // ----------------------------------------------------
  useEffect(() => {
    async function fetchVideos() {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("world_type", activeWorld)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error cargando videos:", error);
        setErrorMsg("Error al cargar los videos desde la base de datos.");
        setLoading(false);
        return;
      }

      const list = data || [];
      setVideos(list);
      setLoading(false);

      const userIds = Array.from(new Set(list.map((v) => v.user_id).filter((id) => !!id)));
      if (userIds.length === 0) return;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, avatar_url, creative_trend")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error cargando perfiles de creadores:", profilesError);
        return;
      }

      const map = {};
      (profiles || []).forEach((p) => {
        map[p.id] = p;
      });
      setCreatorProfiles(map);
    }

    fetchVideos();
  }, [activeWorld]);

  // ----------------------------------------------------
  // Cargar análisis IA para los videos del feed
  // ----------------------------------------------------
  useEffect(() => {
    async function loadAnalysesForVideos() {
      if (!videos || videos.length === 0) {
        setAnalysisByVideo({});
        return;
      }

      const ids = Array.from(new Set(videos.map((v) => v.id).filter(Boolean)));
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from("video_analysis")
        .select(
          "video_id, mood_detected, emotion, clarity, narrative_quality, creativity_score, advice"
        )
        .in("video_id", ids);

      if (error) {
        console.error("Error cargando análisis de videos:", error);
        return;
      }

      const map = {};
      (data || []).forEach((row) => {
        if (!map[row.video_id]) map[row.video_id] = row;
      });
      setAnalysisByVideo(map);
    }

    loadAnalysesForVideos();
  }, [videos]);

  // ----------------------------------------------------
  // Cargar reacciones de Supabase para los videos
  // ----------------------------------------------------
  useEffect(() => {
    async function loadReactions() {
      if (!videos || videos.length === 0) {
        setReactionsByVideo({});
        return;
      }

      const ids = Array.from(new Set(videos.map((v) => v.id).filter(Boolean)));
      if (ids.length === 0) {
        setReactionsByVideo({});
        return;
      }

      const { data, error } = await supabase
        .from("video_reactions")
        .select("video_id, user_id, reaction")
        .in("video_id", ids);

      if (error) {
        console.error("Error cargando reacciones:", error);
        return;
      }

      const map = {};
      (data || []).forEach((row) => {
        if (!map[row.video_id]) map[row.video_id] = [];
        map[row.video_id].push(row);
      });

      setReactionsByVideo(map);
    }

    loadReactions();
  }, [videos]);

  // ----------------------------------------------------
  // Misión creativa sugerida para el usuario actual
  // ----------------------------------------------------
  useEffect(() => {
    async function loadPersonalMission() {
      if (!currentUser) {
        setPersonalMission(null);
        return;
      }

      const { data, error } = await supabase
        .from("video_analysis")
        .select("mood_detected, advice, created_at, video:video_id(user_id)")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Error cargando misión creativa:", error);
        setPersonalMission(null);
        return;
      }

      const mine = (data || []).find((row) => row.video && row.video.user_id === currentUser.id);

      if (!mine) {
        setPersonalMission(null);
        return;
      }

      setPersonalMission({
        mood_detected: mine.mood_detected,
        advice: mine.advice,
        created_at: mine.created_at,
      });
    }

    loadPersonalMission();
  }, [currentUser]);

  // Likes
  const handleLike = async (videoId) => {
    try {
      const video = videos.find((v) => v.id === videoId);
      if (!video) return;

      const currentLikes = video.likes ?? 0;

      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, likes: currentLikes + 1 } : v))
      );

      const { error } = await supabase
        .from("videos")
        .update({ likes: currentLikes + 1 })
        .eq("id", videoId);

      if (error) {
        console.error("Error actualizando likes:", error);
        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, likes: currentLikes } : v))
        );
      }
    } catch (err) {
      console.error("Error inesperado al dar like:", err);
    }
  };

  // Vistas
  const handleView = async (videoId) => {
    try {
      if (viewedIds.has(videoId)) return;

      const video = videos.find((v) => v.id === videoId);
      if (!video) return;

      const currentViews = video.views ?? 0;

      setViewedIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(videoId);
        return newSet;
      });

      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, views: currentViews + 1 } : v))
      );

      const { error } = await supabase
        .from("videos")
        .update({ views: currentViews + 1 })
        .eq("id", videoId);

      if (error) {
        console.error("Error actualizando vistas:", error);

        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, views: currentViews } : v))
        );

        setViewedIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(videoId);
          return newSet;
        });
      }
    } catch (err) {
      console.error("Error inesperado al contar vista:", err);
    }
  };

  // Seguir / dejar de seguir
  const handleToggleFollow = async (targetUserId) => {
    if (!currentUser) {
      setErrorMsg("Necesitas iniciar sesión para seguir creadores.");
      return;
    }
    if (targetUserId === currentUser.id) return;

    const already = followingIds.has(targetUserId);

    try {
      if (already) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUser.id)
          .eq("following_id", targetUserId);

        if (error) {
          console.error("Error al dejar de seguir:", error);
          return;
        }

        setFollowingIds((prev) => {
          const set = new Set(prev);
          set.delete(targetUserId);
          return set;
        });
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: currentUser.id,
          following_id: targetUserId,
        });

        if (error) {
          console.error("Error al seguir:", error);
          return;
        }

        setFollowingIds((prev) => {
          const set = new Set(prev);
          set.add(targetUserId);
          return set;
        });
      }
    } catch (err) {
      console.error("Error inesperado en seguir/dejar de seguir:", err);
    }
  };

  // Compartir
  const handleShare = async (video) => {
    const shareUrl = video.video_url;

    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title || "Video en AUREVI",
          text: "Mira este video en AUREVI",
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Enlace copiado al portapapeles.");
      } else {
        alert("No se pudo compartir automáticamente. Enlace: " + shareUrl);
      }
    } catch (err) {
      console.error("Error al compartir:", err);
    }
  };

  // Eliminar (✅ con verificación real)
  const handleDelete = async (videoId) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;

    if (!currentUser || video.user_id !== currentUser.id) {
      setErrorMsg("Solo puedes eliminar tus propios videos.");
      return;
    }

    const confirmDelete = window.confirm("¿Seguro que quieres eliminar este video de AUREVI?");
    if (!confirmDelete) return;

    try {
      setErrorMsg("");

      const { data: deletedRows, error: dbError } = await supabase
        .from("videos")
        .delete()
        .eq("id", videoId)
        .eq("user_id", currentUser.id)
        .select("id");

      console.log("DELETE result:", deletedRows, "dbError:", dbError);

      if (dbError) {
        console.error("Error al borrar el video en la base de datos:", dbError);
        setErrorMsg("No se pudo eliminar el video (permiso/política).");
        return;
      }

      if (!deletedRows || deletedRows.length === 0) {
        setErrorMsg("No se eliminó ningún registro. Revisa RLS/políticas en Supabase.");
        return;
      }

      if (video.file_path) {
        const { error: storageError } = await supabase.storage
          .from("aurevi-videos")
          .remove([video.file_path]);

        if (storageError) {
          console.error("Error al eliminar archivo de Storage:", storageError);
        }
      }

      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch (err) {
      console.error("Error inesperado al eliminar video:", err);
      setErrorMsg("Ocurrió un error inesperado al eliminar el video.");
    }
  };

  // Manejar reacción
  const handleReaction = async (videoId, reactionKey) => {
    if (!currentUser) {
      setErrorMsg("Necesitas iniciar sesión para reaccionar a los videos.");
      return;
    }

    setErrorMsg("");

    const currentList = reactionsByVideo[videoId] || [];
    const existing = currentList.find((r) => r.user_id === currentUser.id);

    const isSame = existing && existing.reaction === reactionKey;

    let newList;
    if (isSame) {
      newList = currentList.filter((r) => r.user_id !== currentUser.id);
    } else if (existing) {
      newList = currentList.map((r) =>
        r.user_id === currentUser.id ? { ...r, reaction: reactionKey } : r
      );
    } else {
      newList = [
        ...currentList,
        { video_id: videoId, user_id: currentUser.id, reaction: reactionKey },
      ];
    }

    setReactionsByVideo((prev) => ({
      ...prev,
      [videoId]: newList,
    }));

    try {
      if (isSame) {
        const { error } = await supabase
          .from("video_reactions")
          .delete()
          .eq("video_id", videoId)
          .eq("user_id", currentUser.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("video_reactions")
          .upsert(
            { video_id: videoId, user_id: currentUser.id, reaction: reactionKey },
            { onConflict: "video_id,user_id" }
          );

        if (error) throw error;
      }
    } catch (err) {
      console.error("Error guardando reacción:", err);
      setErrorMsg("No se pudo guardar tu reacción. Intenta de nuevo.");

      try {
        const { data, error } = await supabase
          .from("video_reactions")
          .select("video_id, user_id, reaction")
          .eq("video_id", videoId);

        if (!error) {
          setReactionsByVideo((prev) => ({
            ...prev,
            [videoId]: data || [],
          }));
        }
      } catch (err2) {
        console.error("Error recargando reacciones:", err2);
      }
    }
  };

  // Helpers IA
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

  const renderScoreBar = (score) => {
    if (score == null) return null;
    const safeScore = Math.max(1, Math.min(5, Number(score) || 1));
    const segments = Array.from({ length: 5 }, (_, i) => i < safeScore);

    return (
      <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
        {segments.map((active, idx) => (
          <span
            key={idx}
            style={{
              width: 10,
              height: 5,
              borderRadius: 999,
              background: active
                ? "linear-gradient(90deg,#4ade80,#22c55e)"
                : "rgba(55,65,81,0.9)",
            }}
          />
        ))}
      </div>
    );
  };

  const reactionLabel = (reaction) => {
    switch (reaction) {
      case "calma":
        return "Calma 😌";
      case "inspirado":
        return "Inspirado ✨";
      case "aprendi":
        return "Aprendí 📚";
      case "me_rei":
        return "Me reí 😂";
      case "me_ayudo":
        return "Me ayudó 🤝";
      default:
        return null;
    }
  };

  // ----------------------------------------------------
  // Aplicar filtros: feedMode + mood + afinidad
  // ----------------------------------------------------
  let filteredVideos =
    feedMode === "following"
      ? videos.filter((v) => currentUser && v.user_id && followingIds.has(v.user_id))
      : videos;

  if (moodFilterMode === "mood" && viewerMood && recommendedCategories.length) {
    const cats = new Set(recommendedCategories);
    filteredVideos = filteredVideos.filter((v) => (v.category ? cats.has(v.category) : false));
  }

  if (recommendedCategories.length > 0) {
    const cats = new Set(recommendedCategories);
    filteredVideos = [...filteredVideos].sort((a, b) => {
      const aMatch = a.category && cats.has(a.category);
      const bMatch = b.category && cats.has(b.category);
      if (aMatch === bMatch) return 0;
      return aMatch ? -1 : 1;
    });
  }

  const worldLabel = WORLD_LABELS[activeWorld] || "Mundo público";

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------
  return (
    <section className="aurevi-screen aurevi-home-screen">
      <div className="aurevi-home-top">
        <h2 className="aurevi-screen-title">Inicio</h2>
        <p className="aurevi-screen-description">
          Aquí verás el flujo principal de videos de AUREVI.
        </p>

        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
          <strong>Mundo activo:</strong> {activeWorld}
        </p>
      </div>

      {currentUser && (viewerMood || viewerTrend || personalMission || topReaction) && (
        <div
          className="aurevi-feed-card aurevi-home-mood-card"
          style={{ marginBottom: 16, padding: "10px 14px" }}
        >
          <p
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              margin: 0,
              opacity: 0.7,
            }}
          >
            Tu clima creativo de hoy
          </p>

          <div style={{ marginTop: 4, fontSize: 14 }}>
            <span style={{ display: "block", marginBottom: 4 }}>
              Estás navegando en: <strong>{worldLabel}</strong>
            </span>

            {(viewerMood || viewerTrend) && (
              <>
                {viewerMood && (
                  <span style={{ marginRight: 12 }}>
                    Ritmo emocional:{" "}
                    <strong>
                      {{
                        energetico: "Energético",
                        suave: "Suave",
                        introspectivo: "Introspectivo",
                        infantil: "Infantil / juguetón",
                        terapeutico: "Terapéutico",
                      }[viewerMood] || viewerMood}
                    </strong>
                  </span>
                )}
                {viewerTrend && (
                  <span>
                    Tendencia creativa:{" "}
                    <strong>
                      {{
                        explorador: "Explorador de ideas",
                        constructor: "Constructor/a de conocimientos",
                        narrador: "Narrador/a",
                        musico: "Músico / sonoro",
                        mentor: "Mentor / guía",
                        multicreativo: "Multicreativo",
                      }[viewerTrend] || viewerTrend}
                    </strong>
                  </span>
                )}
              </>
            )}
          </div>

          {topReaction && (
            <div style={{ marginTop: 6, fontSize: 13, color: "#e5e7eb" }}>
              Reacción que más usas últimamente: <strong>{reactionLabel(topReaction)}</strong>
            </div>
          )}

          {personalMission && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 12,
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(148,163,184,0.4)",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "#9ca3af",
                  marginBottom: 4,
                }}
              >
                Misión creativa sugerida
              </div>
              <div style={{ fontSize: 11, marginBottom: 3, color: "#e5e7eb" }}>
                Clima de tus últimos videos:{" "}
                <strong>{renderMoodLabel(personalMission.mood_detected)}</strong>
              </div>
              {personalMission.advice && (
                <div style={{ color: "#e5e7eb" }}>{personalMission.advice}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="aurevi-home-filters">
        <div className="profile-mode-toggle">
          <button
            type="button"
            className={"profile-mode-btn" + (feedMode === "all" ? " active" : "")}
            onClick={() => setFeedMode("all")}
          >
            Todo AUREVI
          </button>
          <button
            type="button"
            className={"profile-mode-btn" + (feedMode === "following" ? " active" : "")}
            onClick={() => setFeedMode("following")}
            disabled={!currentUser}
          >
            Solo gente que sigo
          </button>
        </div>

        {viewerMood && (
          <div className="profile-mode-toggle aurevi-home-mood-toggle">
            <button
              type="button"
              className={"profile-mode-btn" + (moodFilterMode === "none" ? " active" : "")}
              onClick={() => setMoodFilterMode("none")}
            >
              Ver todo
            </button>
            <button
              type="button"
              className={"profile-mode-btn" + (moodFilterMode === "mood" ? " active" : "")}
              onClick={() => setMoodFilterMode("mood")}
            >
              Sintonizar con mi mood
            </button>
          </div>
        )}
      </div>

      {loading && <p className="aurevi-home-status">Consultando videos...</p>}

      {errorMsg && <p className="aurevi-home-status aurevi-home-status-error">{errorMsg}</p>}

      {!loading && filteredVideos.length === 0 && (
        <p className="aurevi-home-status">
          {feedMode === "following"
            ? "Todavía no hay videos de las personas que sigues en este mundo. Descubre nuevos creadores en AUREVI."
            : moodFilterMode === "mood"
            ? "No encontramos videos que encajen con tu estado actual en este mundo. Prueba cambiar la categoría o quitar el filtro de mood."
            : "No hay videos aún en este mundo. Sé el primero en subir uno en la pestaña Crear."}
        </p>
      )}

      <div className="aurevi-feed-list">
        {filteredVideos.map((video, idx) => {
          const isOwn = currentUser && video.user_id && video.user_id === currentUser.id;
          const isFollowing = currentUser && video.user_id ? followingIds.has(video.user_id) : false;

          const creator = video.user_id ? creatorProfiles[video.user_id] || null : null;
          const creatorTrend = creator?.creative_trend || null;

          const analysis = analysisByVideo[video.id];

          const listReactions = reactionsByVideo[video.id] || [];
          const counts = listReactions.reduce((acc, r) => {
            acc[r.reaction] = (acc[r.reaction] || 0) + 1;
            return acc;
          }, {});
          const myReaction = currentUser
            ? listReactions.find((r) => r.user_id === currentUser.id)?.reaction || null
            : null;

          return (
            <React.Fragment key={video.id}>
              {/* ✅ Post normal */}
              <article className="aurevi-feed-card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "999px",
                        background:
                          "radial-gradient(circle at 30% 20%, #f97316, #4f46e5 55%, #020617)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                        fontSize: 14,
                        color: "#f9fafb",
                        fontWeight: 600,
                      }}
                    >
                      {creator?.avatar_url ? (
                        <img
                          src={creator.avatar_url}
                          alt="Avatar creador"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span>
                          {video.title?.[0]?.toUpperCase() ||
                            currentUser?.email?.[0]?.toUpperCase() ||
                            "A"}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="aurevi-feed-title" style={{ margin: 0, fontSize: "0.98rem" }}>
                        {video.title || "Video sin título"}
                      </h3>

                      {creatorTrend && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 2,
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(15,23,42,0.9)",
                            color: "#e5e7eb",
                          }}
                        >
                          {{
                            explorador: "Explorador de ideas",
                            constructor: "Constructor/a de conocimientos",
                            narrador: "Narrador/a",
                            musico: "Músico / sonoro",
                            mentor: "Mentor / guía",
                            multicreativo: "Multicreativo",
                          }[creatorTrend] || creatorTrend}
                        </span>
                      )}
                    </div>
                  </div>

                  {currentUser && !isOwn && video.user_id && (
                    <button
                      type="button"
                      onClick={() => handleToggleFollow(video.user_id)}
                      style={{
                        borderRadius: 999,
                        border: "none",
                        padding: "6px 14px",
                        fontSize: 13,
                        cursor: "pointer",
                        background: isFollowing ? "#1f2937" : "#4b5563",
                        color: "#fff",
                      }}
                    >
                      {isFollowing ? "Siguiendo" : "Seguir"}
                    </button>
                  )}
                </div>

                <video
                  src={video.video_url}
                  controls
                  className="aurevi-video-player"
                  onPlay={() => handleView(video.id)}
                />

                {video.description && <p className="aurevi-feed-description">{video.description}</p>}

                {analysis && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: 8,
                      borderRadius: 12,
                      background: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(148,163,184,0.45)",
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(30,64,175,0.9)",
                          color: "#e5e7eb",
                        }}
                      >
                        Clima IA: {renderMoodLabel(analysis.mood_detected)}
                      </span>
                      {analysis.emotion && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(15,23,42,0.9)",
                            color: "#e5e7eb",
                          }}
                        >
                          Emoción: {analysis.emotion}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))",
                        gap: 6,
                      }}
                    >
                      <div>
                        <div>Claridad</div>
                        <div style={{ color: "#9ca3af" }}>{analysis.clarity ?? "—"}/5</div>
                        {renderScoreBar(analysis.clarity)}
                      </div>
                      <div>
                        <div>Narrativa</div>
                        <div style={{ color: "#9ca3af" }}>
                          {analysis.narrative_quality ?? "—"}/5
                        </div>
                        {renderScoreBar(analysis.narrative_quality)}
                      </div>
                      <div>
                        <div>Creatividad</div>
                        <div style={{ color: "#9ca3af" }}>
                          {analysis.creativity_score ?? "—"}/5
                        </div>
                        {renderScoreBar(analysis.creativity_score)}
                      </div>
                    </div>
                  </div>
                )}

                <VideoReactions
                  videoId={video.id}
                  userReaction={myReaction}
                  counts={counts}
                  onReact={(reactionKey) => handleReaction(video.id, reactionKey)}
                />

                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleLike(video.id)}
                    style={{
                      border: "none",
                      borderRadius: 20,
                      padding: "6px 14px",
                      cursor: "pointer",
                      fontSize: 14,
                      background: "linear-gradient(90deg, #ff7aa2, #ffb347, #ffd452)",
                    }}
                  >
                    ❤️ Me gusta
                  </button>

                  <span style={{ fontSize: 14, opacity: 0.9 }}>{video.likes ?? 0} me gusta</span>
                  <span style={{ fontSize: 14, opacity: 0.9 }}>👁️ {video.views ?? 0} vistas</span>

                  <button
                    type="button"
                    onClick={() => handleShare(video)}
                    style={{
                      border: "none",
                      borderRadius: 20,
                      padding: "6px 14px",
                      cursor: "pointer",
                      fontSize: 14,
                      background: "#111827",
                      color: "#e5e7eb",
                    }}
                  >
                    🔗 Compartir
                  </button>
                </div>

                {/* ✅ Eliminar solo si es propio */}
                {isOwn && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(video.id)}
                      style={{
                        border: "none",
                        borderRadius: 20,
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontSize: 14,
                        background: "#ef4444",
                        color: "#fff",
                      }}
                    >
                      🗑️ Eliminar video
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <CommentsPanel videoId={video.id} />
                </div>
              </article>

              {/* ✅ Anuncio nativo cada N posts */}
              {(idx + 1) % AD_EVERY === 0 && (
                <div style={{ margin: "12px 0" }}>
                  <AdCard
                    ad={firstAd}
                    onClick={(ad) => console.log("[ad click]", ad?.id)}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

export default HomeFeed;