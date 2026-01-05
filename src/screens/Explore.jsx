// src/screens/Explore.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import CollectionEditor from "../components/CollectionEditor.jsx";

function Explore() {
  /* ============================================================
     ESTADOS BASE
     ============================================================ */
  const [videosByCategory, setVideosByCategory] = useState({});
  const [allVideos, setAllVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [viewerMood, setViewerMood] = useState("");
  const [viewerTrend, setViewerTrend] = useState("");
  const [creatorProfiles, setCreatorProfiles] = useState({});

  /* ============================================================
     ✅ MODO SOLO PÚBLICAS (Explore)
     ============================================================ */
  const [onlyPublic, setOnlyPublic] = useState(true);

  /* ============================================================
     ✅ FOTOS PÚBLICAS (ÁLBUM) — estilo Instagram
     ============================================================ */
  const [publicPhotos, setPublicPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState("");

  // visor simple para fotos
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  /* ============================================================
     ✅ SWIPE (touch) para visor de fotos
     ============================================================ */
  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lock: null, // "h" | "v"
    moved: false,
  });

  /* ============================================================
     COLECCIONES VIVAS + EDITOR
     ============================================================ */
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState(null);

  /* ============================================================
     CONFIG BÁSICA
     ============================================================ */
  const categoriesOrder = [
    "infantil",
    "aprendizaje",
    "musica",
    "bienestar",
    "creatividad",
    "otros",
  ];

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

  const recommendedCategories = moodToCategories(viewerMood);

  /* ============================================================
     ✅ HELPER — PUBLIC/PRIVATE (no rompe si la columna no existe)
     ============================================================ */
  const isVideoPublic = (v) => {
    if (!v || typeof v !== "object") return true;

    if (Object.prototype.hasOwnProperty.call(v, "is_public")) return !!v.is_public;

    if (Object.prototype.hasOwnProperty.call(v, "visibility")) {
      return String(v.visibility || "").toLowerCase() === "public";
    }

    return true;
  };

  /* ============================================================
     ✅ HELPER — URL pública de foto (bucket aurevi-photos)
     ============================================================ */
  const publicPhotoUrlFor = (filePath) => {
    if (!filePath) return "";
    const { data } = supabase.storage.from("aurevi-photos").getPublicUrl(filePath);
    return data?.publicUrl || "";
  };

  /* ============================================================
     1) CARGAR CLIMA EMOCIONAL DEL USUARIO
     ============================================================ */
  useEffect(() => {
    async function loadUserMood() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error obteniendo usuario:", error);
        return;
      }
      if (!data?.user) return;

      const userId = data.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("daily_mood, creative_trend")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error cargando perfil emocional:", profileError);
        return;
      }

      if (profile) {
        setViewerMood(profile.daily_mood || "");
        setViewerTrend(profile.creative_trend || "");
      }
    }

    loadUserMood();
  }, []);

  /* ============================================================
     ✅ CARGAR FOTOS PÚBLICAS (album_photos)
     ============================================================ */
  const loadPublicPhotos = async () => {
    setPhotosLoading(true);
    setPhotosError("");

    try {
      const { data, error } = await supabase
        .from("album_photos")
        .select("id, file_path, caption, created_at")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setPublicPhotos(data || []);
    } catch (e) {
      console.error("Error cargando fotos públicas:", e);
      setPhotosError("No se pudieron cargar las fotos públicas.");
      setPublicPhotos([]);
    }

    setPhotosLoading(false);
  };

  useEffect(() => {
    loadPublicPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================
     2) CARGAR TODOS LOS VIDEOS (BASE DEL SISTEMA)
     ============================================================ */
  useEffect(() => {
    async function loadVideos() {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg("No se pudieron cargar los videos de Explorar.");
        console.error("Error cargando videos en Explorar:", error);
        setLoading(false);
        return;
      }

      let list = data || [];
      if (onlyPublic) list = list.filter(isVideoPublic);

      setAllVideos(list);

      const grouped = {};
      list.forEach((v) => {
        const c = v.category || "otros";
        if (!grouped[c]) grouped[c] = [];
        grouped[c].push(v);
      });

      setVideosByCategory(grouped);
      setLoading(false);

      const ids = Array.from(new Set(list.map((v) => v.user_id).filter(Boolean)));

      if (ids.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, avatar_url, creative_trend")
          .in("id", ids);

        if (profilesError) {
          console.error("Error cargando perfiles en Explorar:", profilesError);
          return;
        }

        const map = {};
        (profiles || []).forEach((p) => {
          map[p.id] = p;
        });
        setCreatorProfiles(map);
      } else {
        setCreatorProfiles({});
      }
    }

    loadVideos();
  }, [onlyPublic]);

  /* ============================================================
     3) HELPER — NOMBRE BONITO DE CATEGORÍAS
     ============================================================ */
  const renderCategoryTitle = (cat) => {
    switch (cat) {
      case "infantil":
        return "Infantil";
      case "aprendizaje":
        return "Aprendizaje";
      case "musica":
        return "Música";
      case "bienestar":
        return "Bienestar";
      case "creatividad":
        return "Creatividad";
      case "otros":
      default:
        return "Otros";
    }
  };

  /* ============================================================
     4) HELPER — NOMBRE BONITO DEL TIPO DE COLECCIÓN
     ============================================================ */
  const renderCollectionType = (type) => {
    switch (type) {
      case "manual":
        return "Colección manual";
      case "collaborative":
        return "Colección colaborativa";
      case "auto_mood":
        return "Se adapta a tu mood";
      case "auto_time":
        return "Según el momento del día";
      case "auto_trend":
        return "Según tu estilo creativo";
      default:
        return "Colección";
    }
  };

  /* ============================================================
     5) HELPER — CONSTRUCCIÓN DE COLECCIONES AUTO_*
     ============================================================ */
  const buildAutoCollectionVideos = (c) => {
    let pool = [...allVideos];

    if (c.type === "auto_mood" && viewerMood) {
      const cats = moodToCategories(viewerMood);
      if (cats.length > 0) pool = pool.filter((v) => cats.includes(v.category || "otros"));
    }

    if (c.category_filter) {
      const parts = Array.isArray(c.category_filter)
        ? c.category_filter
        : c.category_filter
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      if (parts.length > 0) pool = pool.filter((v) => parts.includes(v.category || "otros"));
    }

    if (c.is_kids_safe) {
      pool = pool.filter((v) => v.category === "infantil");
    }

    return pool.slice(0, 10);
  };

  /* ============================================================
     6) FUNCIÓN PARA CARGAR COLECCIONES VIVAS
     ============================================================ */
  const reloadCollections = async () => {
    if (allVideos.length === 0) {
      setCollections([]);
      return;
    }

    setCollectionsLoading(true);

    const { data: cols, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando colecciones:", error);
      setCollectionsLoading(false);
      return;
    }

    const list = cols || [];

    const videoMap = {};
    allVideos.forEach((v) => {
      videoMap[v.id] = v;
    });

    const manualIds = list
      .filter((c) => c.type === "manual" || c.type === "collaborative")
      .map((c) => c.id);

    let itemsByCollection = {};

    if (manualIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from("collection_items")
        .select("collection_id, video_id, sort_order")
        .in("collection_id", manualIds)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        console.error("Error cargando collection_items:", itemsError);
      } else {
        (items || []).forEach((item) => {
          const v = videoMap[item.video_id];
          if (!v) return;
          if (!itemsByCollection[item.collection_id]) itemsByCollection[item.collection_id] = [];
          itemsByCollection[item.collection_id].push(v);
        });
      }
    }

    const enriched = list.map((c) => {
      let videos = [];
      if (c.type === "manual" || c.type === "collaborative") {
        videos = itemsByCollection[c.id] || [];
      } else if (c.type && c.type.startsWith("auto")) {
        videos = buildAutoCollectionVideos(c);
      }
      return { ...c, videos };
    });

    setCollections(enriched);
    setCollectionsLoading(false);
  };

  useEffect(() => {
    reloadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVideos, viewerMood]);

  const totalVideosCount = useMemo(() => allVideos.length, [allVideos]);

  /* ============================================================
     ✅ Visor fotos
     ============================================================ */
  const openPhotoViewerAt = (index) => {
    if (!publicPhotos?.length) return;
    const safe = Math.max(0, Math.min(index, publicPhotos.length - 1));
    setPhotoViewerIndex(safe);
    setPhotoViewerOpen(true);
  };
  const closePhotoViewer = () => setPhotoViewerOpen(false);
  const prevPhoto = () => {
    if (!publicPhotos?.length) return;
    setPhotoViewerIndex((i) => (i - 1 + publicPhotos.length) % publicPhotos.length);
  };
  const nextPhoto = () => {
    if (!publicPhotos?.length) return;
    setPhotoViewerIndex((i) => (i + 1) % publicPhotos.length);
  };

  useEffect(() => {
    if (!photoViewerOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") closePhotoViewer();
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
    };

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoViewerOpen, publicPhotos.length]);

  const activePublicPhoto = photoViewerOpen ? publicPhotos[photoViewerIndex] : null;
  const activePublicPhotoUrl = activePublicPhoto
    ? publicPhotoUrlFor(activePublicPhoto.file_path)
    : "";

  /* ============================================================
     ✅ Touch handlers (swipe)
     ============================================================ */
  const onTouchStartViewer = (e) => {
    const t = e.touches?.[0];
    if (!t) return;

    swipeRef.current.active = true;
    swipeRef.current.startX = t.clientX;
    swipeRef.current.startY = t.clientY;
    swipeRef.current.lastX = t.clientX;
    swipeRef.current.lastY = t.clientY;
    swipeRef.current.lock = null;
    swipeRef.current.moved = false;
  };

  const onTouchMoveViewer = (e) => {
    if (!swipeRef.current.active) return;
    const t = e.touches?.[0];
    if (!t) return;

    const dx = t.clientX - swipeRef.current.startX;
    const dy = t.clientY - swipeRef.current.startY;

    swipeRef.current.lastX = t.clientX;
    swipeRef.current.lastY = t.clientY;

    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // decide lock (horizontal vs vertical) después de un pequeño movimiento
    if (!swipeRef.current.lock) {
      if (adx < 10 && ady < 10) return;
      swipeRef.current.lock = adx >= ady ? "h" : "v";
    }

    swipeRef.current.moved = true;

    // Si ya “bloqueamos” dirección, evitamos que el navegador scrollee
    // (solo dentro del visor)
    e.preventDefault();
  };

  const onTouchEndViewer = () => {
    if (!swipeRef.current.active) return;

    const dx = swipeRef.current.lastX - swipeRef.current.startX;
    const dy = swipeRef.current.lastY - swipeRef.current.startY;

    swipeRef.current.active = false;

    // si casi no se movió, no hacemos nada
    if (!swipeRef.current.moved) return;

    const lock = swipeRef.current.lock;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // umbrales “instagram-ish”
    const H_THRESHOLD = 55;
    const V_THRESHOLD = 80;

    if (lock === "h" && adx >= H_THRESHOLD && adx >= ady) {
      if (dx < 0) nextPhoto(); // swipe left
      else prevPhoto(); // swipe right
      return;
    }

    if (lock === "v" && ady >= V_THRESHOLD && ady > adx) {
      if (dy > 0) closePhotoViewer(); // swipe down closes
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <section className="aurevi-screen">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 className="aurevi-screen-title">Explorar</h2>
          <p className="aurevi-screen-description">
            Descubre colecciones de videos por categoría. Algunas se adaptan a tu
            estado creativo–emocional.
          </p>
        </div>

        <div
          className="aurevi-feed-card"
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={onlyPublic}
              onChange={(e) => setOnlyPublic(e.target.checked)}
            />
            Solo públicas
          </label>

          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {totalVideosCount} video(s)
          </span>
        </div>
      </div>

      {/* ===================== ✅ FOTOS PÚBLICAS ===================== */}
      <div style={{ marginTop: 14, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Fotos públicas</h3>

          <button
            type="button"
            onClick={loadPublicPhotos}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.25)",
              padding: "6px 10px",
              fontSize: 12,
              cursor: "pointer",
              background: "rgba(15,23,42,0.55)",
              color: "#e5e7eb",
            }}
            title="Actualizar"
          >
            ↻ Actualizar
          </button>
        </div>

        {photosLoading && <p style={{ color: "#9ca3af" }}>Cargando fotos públicas...</p>}
        {photosError && <p style={{ color: "#fca5a5" }}>{photosError}</p>}

        {!photosLoading && !photosError && publicPhotos.length === 0 && (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>
            Aún no hay fotos públicas.
          </p>
        )}

        {publicPhotos.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              paddingBottom: 6,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {publicPhotos.map((p, idx) => {
              const url = publicPhotoUrlFor(p.file_path);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openPhotoViewerAt(idx)}
                  title="Ver foto"
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(15,23,42,0.70)",
                    borderRadius: 16,
                    padding: 8,
                    minWidth: 118,
                    cursor: "zoom-in",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 102,
                      height: 102,
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(148,163,184,0.18)",
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={p.caption || "Foto"}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#9ca3af", fontSize: 12 }}>
                        Sin imagen
                      </div>
                    )}
                  </div>

                  {(p.caption || "").trim() && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: "#e5e7eb",
                        maxWidth: 102,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        opacity: 0.95,
                      }}
                    >
                      {p.caption}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== CLIMA CREATIVO ===================== */}
      {(viewerMood || viewerTrend) && (
        <div
          className="aurevi-feed-card"
          style={{ marginBottom: 20, padding: "12px 14px" }}
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
            Tu clima creativo
          </p>

          <div style={{ marginTop: 4, fontSize: 14 }}>
            {viewerMood && (
              <span style={{ marginRight: 12 }}>
                Mood: <strong>{viewerMood}</strong>
              </span>
            )}
            {viewerTrend && (
              <span>
                Tendencia: <strong>{viewerTrend}</strong>
              </span>
            )}
          </div>

          {viewerMood && recommendedCategories.length > 0 && (
            <p style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
              Hoy te pueden sentar bien colecciones como:{" "}
              {recommendedCategories.map((c) => renderCategoryTitle(c)).join(", ")}.
            </p>
          )}
        </div>
      )}

      {/* ===================== COLECCIONES VIVAS ===================== */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Colecciones vivas</h3>

          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setShowEditor(true);
            }}
            className="aurevi-primary-btn"
            style={{ paddingInline: 14, paddingBlock: 6, fontSize: 13 }}
          >
            Crear colección
          </button>
        </div>

        {collectionsLoading && (
          <p style={{ color: "#9ca3af" }}>Cargando colecciones...</p>
        )}

        {collections.length === 0 && !collectionsLoading && (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>
            Aún no hay colecciones creadas. Muy pronto podrás ver playlists que
            crecen contigo.
          </p>
        )}

        {collections.length > 0 && (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {collections.map((c) => {
              const preview = c.videos || [];

              return (
                <div
                  key={c.id}
                  style={{
                    minWidth: 240,
                    maxWidth: 280,
                    background: "rgba(15,23,42,0.9)",
                    borderRadius: 16,
                    padding: 10,
                    border: "1px solid rgba(148,163,184,0.5)",
                    boxShadow: "0 14px 28px rgba(0,0,0,0.6)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {renderCollectionType(c.type)}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id);
                        setShowEditor(true);
                      }}
                      style={{
                        borderRadius: 999,
                        border: "none",
                        padding: "2px 8px",
                        fontSize: 11,
                        cursor: "pointer",
                        background: "#111827",
                        color: "#e5e7eb",
                      }}
                    >
                      Editar
                    </button>
                  </div>

                  <h4 style={{ margin: "4px 0", fontSize: 14, color: "#f9fafb" }}>
                    {c.name || "Colección sin título"}
                  </h4>

                  {c.description && (
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: "#d1d5db" }}>
                      {c.description}
                    </p>
                  )}

                  {preview.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                      {preview.map((v) => (
                        <video
                          key={v.id}
                          src={v.video_url}
                          muted
                          playsInline
                          style={{
                            width: "100%",
                            maxWidth: 80,
                            borderRadius: 10,
                            background: "#000",
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                      Esta colección aún no tiene videos que mostrar.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== SECCIONES POR CATEGORÍA ===================== */}
      {loading && <p>Cargando contenido por categoría...</p>}
      {errorMsg && <p style={{ color: "#fca5a5", marginTop: 8 }}>{errorMsg}</p>}

      {!loading &&
        categoriesOrder.map((cat) => {
          const videos = videosByCategory[cat] || [];
          if (videos.length === 0) return null;

          const isRecommended = recommendedCategories.includes(cat);

          return (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
                  {renderCategoryTitle(cat)}
                  {isRecommended && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "linear-gradient(120deg, #22c55e, #16a34a)",
                        color: "#f9fafb",
                      }}
                    >
                      Recomendado
                    </span>
                  )}
                </h3>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {videos.length} video(s)
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                {videos.map((video) => {
                  const creator = video.user_id ? creatorProfiles[video.user_id] || null : null;
                  const creatorTrend = creator?.creative_trend || null;

                  return (
                    <div
                      key={video.id}
                      style={{
                        minWidth: 220,
                        maxWidth: 260,
                        background: "rgba(15,23,42,0.9)",
                        borderRadius: 16,
                        padding: 8,
                        border: "1px solid rgba(148,163,184,0.5)",
                        boxShadow: "0 14px 28px rgba(0,0,0,0.6)",
                      }}
                    >
                      <video
                        src={video.video_url}
                        controls
                        style={{
                          width: "100%",
                          height: 60,
                          borderRadius: 12,
                          background: "#000",
                        }}
                      />

                      <h4 style={{ margin: "6px 0 2px", fontSize: 13, color: "#f9fafb" }}>
                        {video.title || "Video sin título"}
                      </h4>

                      {video.description && (
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#d1d5db" }}>
                          {video.description}
                        </p>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
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
                            fontSize: 11,
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
                            <span>{video.title?.[0]?.toUpperCase() || "A"}</span>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {creatorTrend && (
                            <span>
                              {{
                                explorador: "Explorador",
                                constructor: "Constructor",
                                narrador: "Narrador",
                                musico: "Músico",
                                mentor: "Mentor",
                                multicreativo: "Multicreativo",
                              }[creatorTrend] || creatorTrend}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* ===================== MODAL EDITOR DE COLECCIONES ===================== */}
      {showEditor && (
        <CollectionEditor
          open={showEditor}
          onClose={() => {
            setShowEditor(false);
            setEditingId(null);
          }}
          collection={editingId ? collections.find((c) => c.id === editingId) || null : null}
          allVideos={allVideos}
          onSaved={async () => {
            await reloadCollections();
          }}
        />
      )}

      {/* ===================== ✅ VISOR FULLSCREEN DE FOTOS + SWIPE ===================== */}
      {photoViewerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePhotoViewer();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0,0,0,0.82)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              maxHeight: "90vh",
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(2,6,23,0.92)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderBottom: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              <div style={{ color: "#e5e7eb", fontSize: 12, opacity: 0.9 }}>
                {publicPhotos.length > 0 ? (
                  <strong style={{ color: "#fff" }}>
                    {photoViewerIndex + 1}/{publicPhotos.length}
                  </strong>
                ) : (
                  "Foto"
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={prevPhoto}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(15,23,42,0.55)",
                    color: "#e5e7eb",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  ←
                </button>

                <button
                  type="button"
                  onClick={nextPhoto}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(15,23,42,0.55)",
                    color: "#e5e7eb",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  →
                </button>

                <button
                  type="button"
                  onClick={closePhotoViewer}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(239,68,68,0.9)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                  title="Cerrar (Esc / swipe ↓)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Contenido con SWIPE */}
            <div
              onTouchStart={onTouchStartViewer}
              onTouchMove={onTouchMoveViewer}
              onTouchEnd={onTouchEndViewer}
              style={{
                padding: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,0,0,0.20)",
                flex: 1,

                // clave para que el swipe se sienta bien:
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            >
              {activePublicPhotoUrl ? (
                <img
                  src={activePublicPhotoUrl}
                  alt={activePublicPhoto?.caption || "Foto"}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    maxHeight: "72vh",
                    objectFit: "contain",
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.18)",
                    background: "rgba(0,0,0,0.25)",
                  }}
                />
              ) : (
                <div style={{ color: "#9ca3af" }}>Sin imagen</div>
              )}
            </div>

            {(activePublicPhoto?.caption || "").trim() && (
              <div
                style={{
                  padding: "10px 12px",
                  borderTop: "1px solid rgba(148,163,184,0.18)",
                  color: "#e5e7eb",
                  fontSize: 13,
                }}
              >
                {activePublicPhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Explore;