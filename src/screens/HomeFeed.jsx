// src/screens/HomeFeed.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import CommentsPanel from "../components/CommentsPanel";
import VideoReactions from "../components/VideoReactions";
import { useWorld } from "../worlds/WorldContext";
import { WORLD_LABELS } from "../worlds/worldTypes";
import AdCard from "../components/ads/AdCard.jsx";
import ContextDock from "../components/context/ContextDock.jsx";
import CreatorBar from "../components/creator/CreatorBar.jsx";

function HomeFeed({ navigate, params }) {
  const { activeWorld } = useWorld();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [viewedIds, setViewedIds] = useState(new Set());

  const [currentUser, setCurrentUser] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());

  const [feedMode, setFeedMode] = useState("all"); // "all" | "following"

  const [viewerMood, setViewerMood] = useState(""); // daily_mood
  const [viewerTrend, setViewerTrend] = useState(""); // creative_trend

  const [moodFilterMode, setMoodFilterMode] = useState("none"); // "none" | "mood"

  const [creatorProfiles, setCreatorProfiles] = useState({}); // id -> profile
  const [analysisByVideo, setAnalysisByVideo] = useState({});
  const [personalMission, setPersonalMission] = useState(null);
  const [reactionsByVideo, setReactionsByVideo] = useState({});
  const [topReaction, setTopReaction] = useState(null);

  // ✅ video activo para reproducir en el panel izquierdo
  const [activeVideoId, setActiveVideoId] = useState(null);

  // ✅ Preview refs (panel derecho)
  const previewRefs = useRef({});
  const previewTimers = useRef({});

  // ✅ Scroll suave hacia el reproductor + Toast "Reproduciendo: X" + Deshacer
  const mainPlayerRef = useRef(null);
  const commentsRef = useRef(null);

  const lastVideoIdRef = useRef(null); // para "Deshacer"
  const lastSwitchReasonRef = useRef(null); // info opcional

  const [toast, setToast] = useState({
    visible: false,
    text: "",
    undoVideoId: null,
  });

  const toastTimerRef = useRef(null);

  const showToast = (text, undoVideoId = null) => {
    setToast({ visible: true, text: text || "", undoVideoId });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2200);
  };

  useEffect(() => {
    return () => clearTimeout(toastTimerRef.current);
  }, []);

  // ✅ Comentarios desplegables
  const [commentsOpen, setCommentsOpen] = useState(false);

  // Cuando cambias de video, por defecto cerramos comentarios
  useEffect(() => {
    setCommentsOpen(false);
  }, [activeVideoId]);

  // ----------------------------------------------------
  // ✅ Layout responsive SIN window.innerWidth en render
  // ----------------------------------------------------
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => setIsNarrow(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // ----------------------------------------------------
  // ✅ Anuncios (MVP “no invasivo”)
  // ----------------------------------------------------
  const ADS_EVERY = 7;
  const MAX_ADS_PER_SESSION = 2;
  const MIN_POSTS_BETWEEN_ADS = 6;

  const adsPool = useMemo(
    () => [
      {
        id: "ad-001",
        badge: "🤝 Apoyo creativo",
        title: "Edita más rápido tus videos",
        text: "Plantillas, cortes inteligentes y transiciones listas para creadores. Sin complicarte.",
        imageUrl: "/ads/ad-001.png",
        ctaLabel: "Conocer",
        href: "https://example.com",
        placement: "home",
        theme: "soft",
      },
    ],
    []
  );

  const [adsShownCount, setAdsShownCount] = useState(0);
  const [adIndexCursor, setAdIndexCursor] = useState(0);
  const lastAdPostIndexRef = useRef(-999);

  useEffect(() => {
    setAdsShownCount(0);
    setAdIndexCursor(0);
    lastAdPostIndexRef.current = -999;
  }, [activeWorld, feedMode, moodFilterMode]);

  const pickNextAd = () => {
    if (!adsPool.length) return null;
    return adsPool[adIndexCursor % adsPool.length] || null;
  };

  const advanceAdCursor = () => {
    setAdIndexCursor((x) => (x + 1) % Math.max(adsPool.length, 1));
  };

  const shouldInsertAdAfterIndex = (idx, totalPosts) => {
    if (adsShownCount >= MAX_ADS_PER_SESSION) return false;
    if (!adsPool.length) return false;
    if (totalPosts <= 4) return false;

    const baseHit = (idx + 1) % ADS_EVERY === 0;
    if (!baseHit) return false;

    const postsSinceLastAd = idx - lastAdPostIndexRef.current;
    if (postsSinceLastAd < MIN_POSTS_BETWEEN_ADS) return false;

    return true;
  };

  // ----------------------------------------------------
  // ✅ TRACKING REAL (Supabase) — session_id + dedupe
  // ----------------------------------------------------
  const sessionIdRef = useRef(null);
  useEffect(() => {
    const key = "aurevi_session_id";
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid =
        crypto?.randomUUID?.() ||
        String(Date.now()) + "-" + Math.random().toString(16).slice(2);
      sessionStorage.setItem(key, sid);
    }
    sessionIdRef.current = sid;
  }, []);

  const sentEventsRef = useRef(new Set());

  const trackAdEvent = async (eventType, ad, extraMeta = {}) => {
    try {
      if (!currentUser?.id) return;
      if (!ad?.id) return;

      const sid = sessionIdRef.current || "no-session";

      const dedupKey = `${eventType}:${ad.id}:${sid}:${ad.placement || "home"}`;
      if (eventType === "impression") {
        if (sentEventsRef.current.has(dedupKey)) return;
        sentEventsRef.current.add(dedupKey);
      }

      const payload = {
        user_id: currentUser.id,
        session_id: sid,
        ad_id: ad.id,
        placement: ad.placement || "home",
        event_type: eventType,
        world_type: activeWorld,
        feed_mode: feedMode,
        mood_filter_mode: moodFilterMode,
        meta: {
          href: ad.href || null,
          theme: ad.theme || null,
          ...extraMeta,
        },
      };

      const { error } = await supabase.from("ad_events").insert(payload);
      if (error) console.error("ad_events insert error:", error);
    } catch (e) {
      console.error("trackAdEvent error:", e);
    }
  };

  // ----------------------------------------------------
  // ✅ Helpers: tiempo (Nuevo / Hace X)
  // ----------------------------------------------------
  const timeAgo = (iso) => {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - t);

    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins} min`;

    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs} h`;

    const days = Math.floor(hrs / 24);
    if (days === 1) return "Ayer";
    return `Hace ${days} días`;
  };

  const isNewVideo = (iso, hours = 6) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Date.now() - t <= hours * 60 * 60 * 1000;
  };

  // ----------------------------------------------------
  // ✅ Preview silencioso (panel derecho)
  // ----------------------------------------------------
  const stopPreview = (videoId) => {
    const el = previewRefs.current[videoId];
    if (!el) return;

    clearTimeout(previewTimers.current[videoId]);
    previewTimers.current[videoId] = null;

    try {
      el.pause?.();
      el.currentTime = 0;
    } catch {}
  };

  const startPreview = (videoId) => {
    const el = previewRefs.current[videoId];
    if (!el) return;

    try {
      el.muted = true;
      el.playsInline = true;
      el.currentTime = 0;

      const p = el.play?.();
      if (p?.catch) p.catch(() => {});
    } catch {}

    clearTimeout(previewTimers.current[videoId]);
    previewTimers.current[videoId] = setTimeout(() => stopPreview(videoId), 3000);
  };

  // ----------------------------------------------------
  // Helper: mapear mood/reacción a categorías sugeridas
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
  // Reacción predominante del usuario
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

      setActiveVideoId((prev) => prev ?? (list?.[0]?.id || null));

      const userIds = Array.from(
        new Set(list.map((v) => v.user_id).filter((id) => !!id))
      );
      if (userIds.length === 0) return;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, avatar_url, creative_trend, display_name, username")
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
  // ✅ Click en alerta → activar video + scroll al reproductor (usando params)
  // ----------------------------------------------------
  const pendingAlertVideoIdRef = useRef(null);

  const scrollToMainPlayer = () => {
    requestAnimationFrame(() => {
      mainPlayerRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    const targetVideoId = params?.videoId;
    const from = params?.from; // ✅ FIX: aquí estaba el error de sintaxis

    if (!targetVideoId) return;

    pendingAlertVideoIdRef.current = String(targetVideoId);

    if (videos && videos.length > 0) {
      const exists = videos.some(
        (v) => String(v.id) === String(targetVideoId)
      );
      if (!exists) return;

      lastVideoIdRef.current = activeVideoId;
      lastSwitchReasonRef.current = "alerts_click";

      setActiveVideoId(targetVideoId);

      showToast(
        from === "alerts" ? "Abierto desde alertas 🔔" : "Abriendo video…",
        lastVideoIdRef.current
      );

      scrollToMainPlayer();

      // ✅ limpiar params para que no se repita en próximos renders
      navigate?.("home", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.videoId, videos]);

  useEffect(() => {
    const pending = pendingAlertVideoIdRef.current;
    if (!pending) return;
    if (!videos || videos.length === 0) return;

    const exists = videos.some((v) => String(v.id) === String(pending));
    if (!exists) return;

    pendingAlertVideoIdRef.current = null;

    lastVideoIdRef.current = activeVideoId;
    lastSwitchReasonRef.current = "alerts_pending";

    setActiveVideoId(pending);
    showToast("Abierto desde alertas 🔔", lastVideoIdRef.current);
    scrollToMainPlayer();

    // limpiar params
    navigate?.("home", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  // ----------------------------------------------------
  // Cargar análisis IA
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
  // Cargar reacciones
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
  // Misión creativa sugerida
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

      const mine = (data || []).find(
        (row) => row.video && row.video.user_id === currentUser.id
      );

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
        prev.map((v) =>
          v.id === videoId ? { ...v, likes: currentLikes + 1 } : v
        )
      );

      const { error } = await supabase
        .from("videos")
        .update({ likes: currentLikes + 1 })
        .eq("id", videoId);

      if (error) {
        console.error("Error actualizando likes:", error);
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, likes: currentLikes } : v
          )
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
        prev.map((v) =>
          v.id === videoId ? { ...v, views: currentViews + 1 } : v
        )
      );

      const { error } = await supabase
        .from("videos")
        .update({ views: currentViews + 1 })
        .eq("id", videoId);

      if (error) {
        console.error("Error actualizando vistas:", error);

        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, views: currentViews } : v
          )
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

  // Eliminar
  const handleDelete = async (videoId) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;

    if (!currentUser || video.user_id !== currentUser.id) {
      setErrorMsg("Solo puedes eliminar tus propios videos.");
      return;
    }

    const confirmDelete = window.confirm(
      "¿Seguro que quieres eliminar este video de AUREVI?"
    );
    if (!confirmDelete) return;

    try {
      setErrorMsg("");

      const { data: deletedRows, error: dbError } = await supabase
        .from("videos")
        .delete()
        .eq("id", videoId)
        .eq("user_id", currentUser.id)
        .select("id");

      if (dbError) {
        console.error("Error al borrar el video en la base de datos:", dbError);
        setErrorMsg("No se pudo eliminar el video (permiso/política).");
        return;
      }

      if (!deletedRows || deletedRows.length === 0) {
        setErrorMsg(
          "No se eliminó ningún registro. Revisa RLS/políticas en Supabase."
        );
        return;
      }

      if (video.file_path) {
        const { error: storageError } = await supabase.storage
          .from("aurevi-videos")
          .remove([video.file_path]);
        if (storageError)
          console.error("Error al eliminar archivo de Storage:", storageError);
      }

      setVideos((prev) => prev.filter((v) => v.id !== videoId));

      if (activeVideoId === videoId) {
        const remaining = videos.filter((v) => v.id !== videoId);
        setActiveVideoId(remaining?.[0]?.id || null);
      }
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

    setReactionsByVideo((prev) => ({ ...prev, [videoId]: newList }));

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
          setReactionsByVideo((prev) => ({ ...prev, [videoId]: data || [] }));
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
      ? videos.filter(
          (v) => currentUser && v.user_id && followingIds.has(v.user_id)
        )
      : videos;

  if (moodFilterMode === "mood" && viewerMood && recommendedCategories.length) {
    const cats = new Set(recommendedCategories);
    filteredVideos = filteredVideos.filter((v) =>
      v.category ? cats.has(v.category) : false
    );
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

  // ✅ Video activo + lista lateral
  const activeVideo =
    filteredVideos.find((v) => v.id === activeVideoId) ||
    filteredVideos[0] ||
    null;
  const sideVideos = filteredVideos.filter((v) => v.id !== activeVideo?.id);

  // ✅ Ads: escoger uno (si toca) usando la misma lógica base
  const showSideAd = shouldInsertAdAfterIndex(ADS_EVERY - 1, filteredVideos.length);
  const adToShow = showSideAd ? pickNextAd() : null;

  const handleUndo = () => {
    const undoId = toast.undoVideoId;
    if (!undoId) return;

    lastVideoIdRef.current = activeVideoId;
    lastSwitchReasonRef.current = "undo";

    setActiveVideoId(undoId);
    showToast("Deshecho ✅", null);
    scrollToMainPlayer();
  };

  const handleSelectSideVideo = (v) => {
    if (!v?.id) return;

    stopPreview(v.id);

    lastVideoIdRef.current = activeVideoId;
    lastSwitchReasonRef.current = "side_click";

    setActiveVideoId(v.id);

    const name = v.title || "Video sin título";
    showToast(`Reproduciendo: ${name}`, lastVideoIdRef.current);

    scrollToMainPlayer();
  };

  const toggleComments = () => {
    setCommentsOpen((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          commentsRef.current?.scrollIntoView?.({
            behavior: "smooth",
            block: "start",
          });
        });
      }
      return next;
    });
  };

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
              Reacción que más usas últimamente:{" "}
              <strong>{reactionLabel(topReaction)}</strong>
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

      {/* ✅ Toast flotante (con Deshacer) */}
      {toast.visible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 22,
            transform: "translateX(-50%)",
            zIndex: 9999,
            padding: "10px 12px",
            borderRadius: 999,
            background: "rgba(2,6,23,0.92)",
            border: "1px solid rgba(148,163,184,0.28)",
            color: "#e5e7eb",
            fontSize: 13,
            boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
            maxWidth: "min(92vw, 720px)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
          title={toast.text}
        >
          <div
            style={{
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {toast.text}
          </div>

          {toast.undoVideoId && (
            <button
              type="button"
              onClick={handleUndo}
              style={{
                border: "1px solid rgba(148,163,184,0.35)",
                background: "rgba(15,23,42,0.75)",
                color: "#e5e7eb",
                borderRadius: 999,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 800,
              }}
              title="Volver al video anterior"
            >
              ⤺ Deshacer
            </button>
          )}
        </div>
      )}

      {/* ✅ NUEVO LAYOUT: izquierda = video activo | derecha = nuevos videos */}
      {!loading && filteredVideos.length > 0 && (
        <div
          className="aurevi-home-grid"
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "1.55fr 0.85fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          {/* IZQUIERDA: Video activo */}
          <div className="aurevi-home-main">
            {!activeVideo ? (
              <div className="aurevi-feed-card" style={{ padding: 14 }}>
                <div style={{ color: "#9ca3af" }}>No hay video activo.</div>
              </div>
            ) : (
              (() => {
                const video = activeVideo;

                const isOwn =
                  currentUser && video.user_id && video.user_id === currentUser.id;
                const isFollowing =
                  currentUser && video.user_id ? followingIds.has(video.user_id) : false;

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
                  <article
                    ref={mainPlayerRef}
                    className="aurevi-feed-card"
                    style={{
                      border: "1px solid rgba(99,102,241,0.55)",
                      boxShadow:
                        "0 0 0 2px rgba(99,102,241,0.18), 0 12px 32px rgba(0,0,0,0.35)",
                      scrollMarginTop: 96,
                    }}
                  >
                    <div className="aurevi-post" style={{ padding: 2 }}>
                      <CreatorBar
                        creator={{
                          id: video.user_id,
                          avatar_url: creator?.avatar_url,
                          display_name: creator?.display_name,
                          username: creator?.username,
                          creative_trend: creatorTrend,
                        }}
                        isOwn={isOwn}
                        isFollowing={isFollowing}
                        onToggleFollow={handleToggleFollow}
                      />

                      <ContextDock video={video} counts={counts} myReaction={myReaction} />

                      <video
                        key={video.id}
                        src={video.video_url}
                        controls
                        className="aurevi-video-player"
                        onPlay={() => handleView(video.id)}
                        onEnded={() => {
                          const next = sideVideos?.[0];
                          if (next?.id) {
                            lastVideoIdRef.current = video.id;
                            lastSwitchReasonRef.current = "ended_autoplay";

                            setActiveVideoId(next.id);
                            showToast(
                              `Reproduciendo: ${next.title || "Video sin título"}`,
                              lastVideoIdRef.current
                            );
                          }
                        }}
                      />
                    </div>

                    {video.description && (
                      <p className="aurevi-feed-description">{video.description}</p>
                    )}

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
                            <div style={{ color: "#9ca3af" }}>{analysis.narrative_quality ?? "—"}/5</div>
                            {renderScoreBar(analysis.narrative_quality)}
                          </div>
                          <div>
                            <div>Creatividad</div>
                            <div style={{ color: "#9ca3af" }}>{analysis.creativity_score ?? "—"}/5</div>
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

                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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

                      {/* ✅ Botón Comentarios (desplegable) */}
                      <button
                        type="button"
                        onClick={toggleComments}
                        style={{
                          border: "1px solid rgba(148,163,184,0.28)",
                          borderRadius: 20,
                          padding: "6px 14px",
                          cursor: "pointer",
                          fontSize: 14,
                          background: commentsOpen ? "rgba(99,102,241,0.18)" : "rgba(15,23,42,0.8)",
                          color: "#e5e7eb",
                        }}
                        title="Mostrar / ocultar comentarios"
                      >
                        💬 Comentarios {commentsOpen ? "▲" : "▼"}
                      </button>
                    </div>

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

                    {/* ✅ Comentarios desplegables */}
                    <div
                      ref={commentsRef}
                      style={{
                        marginTop: 12,
                        overflow: "hidden",
                        maxHeight: commentsOpen ? 900 : 0,
                        opacity: commentsOpen ? 1 : 0,
                        transition: "max-height 240ms ease, opacity 200ms ease",
                        borderRadius: 14,
                      }}
                    >
                      {commentsOpen && (
                        <div
                          style={{
                            paddingTop: 10,
                            borderTop: "1px solid rgba(148,163,184,0.18)",
                          }}
                        >
                          <CommentsPanel videoId={video.id} />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })()
            )}
          </div>

          {/* DERECHA: Nuevos videos */}
          <aside
            className="aurevi-home-side"
            style={{
              position: isNarrow ? "static" : "sticky",
              top: 88,
            }}
          >
            <div className="aurevi-feed-card" style={{ padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 900, color: "#e5e7eb" }}>Nuevos videos</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{sideVideos.length}</div>
              </div>

              {/* ✅ Ad discreto en el panel derecho */}
              {adToShow && (
                <div style={{ marginTop: 10 }}>
                  <AdCard
                    ad={adToShow}
                    onClick={(ad) => {
                      console.log("[ad click]", ad?.id, ad?.placement);
                      trackAdEvent("click", ad, { source: "cta" });
                    }}
                  />
                  <AdShownSideEffect
                    onShown={() => {
                      trackAdEvent("impression", adToShow);
                      lastAdPostIndexRef.current = ADS_EVERY - 1;
                      setAdsShownCount((n) => n + 1);
                      advanceAdCursor();
                    }}
                  />
                </div>
              )}

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {sideVideos.slice(0, 25).map((v) => {
                  const c = v.user_id ? creatorProfiles[v.user_id] || null : null;
                  const isActive = activeVideoId === v.id;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectSideVideo(v)}
                      onMouseEnter={() => startPreview(v.id)}
                      onMouseLeave={() => stopPreview(v.id)}
                      onTouchStart={() => startPreview(v.id)}
                      onTouchEnd={() => stopPreview(v.id)}
                      style={{
                        textAlign: "left",
                        border: isActive
                          ? "1px solid rgba(99,102,241,0.7)"
                          : "1px solid rgba(148,163,184,0.18)",
                        boxShadow: isActive ? "0 0 0 2px rgba(99,102,241,0.18)" : "none",
                        background: "rgba(2,6,23,0.45)",
                        borderRadius: 14,
                        padding: 10,
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "80px 1fr",
                        gap: 10,
                        alignItems: "center",
                        transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                        transform: isActive ? "translateY(-1px)" : "none",
                      }}
                      title="Reproducir este video"
                    >
                      {/* ✅ Preview real (silencioso) */}
                      <div
                        style={{
                          width: 80,
                          height: 52,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "rgba(15,23,42,0.8)",
                          border: "1px solid rgba(148,163,184,0.2)",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <video
                          ref={(node) => (previewRefs.current[v.id] = node)}
                          src={v.video_url}
                          muted
                          playsInline
                          preload="metadata"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#e5e7eb",
                            fontWeight: 900,
                            textShadow: "0 2px 10px rgba(0,0,0,0.55)",
                            pointerEvents: "none",
                          }}
                        >
                          ▶
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: "#e5e7eb",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {v.title || "Video sin título"}
                        </div>

                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                          {c?.display_name || (c?.username ? `@${c.username}` : "Creador/a")}
                          {v.category ? ` • ${v.category}` : ""}
                        </div>

                        {/* ✅ Nuevo / Hace X */}
                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "rgba(15,23,42,0.85)",
                              border: "1px solid rgba(148,163,184,0.22)",
                              color: "rgba(229,231,235,0.95)",
                            }}
                          >
                            {isNewVideo(v.created_at) ? "🟣 Nuevo" : `🕒 ${timeAgo(v.created_at)}`}
                          </span>

                          <span style={{ fontSize: 12, color: "#9ca3af" }}>
                            👁️ {v.views ?? 0} • ❤️ {v.likes ?? 0}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {sideVideos.length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>
                    No hay más videos para mostrar aquí.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function AdShownSideEffect({ onShown }) {
  useEffect(() => {
    onShown?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default HomeFeed;