// src/screens/Explore.jsx
import React, { useEffect, useState } from "react";
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

      const list = data || [];
      setAllVideos(list);

      // Agrupar por categorías
      const grouped = {};
      list.forEach((v) => {
        const c = v.category || "otros";
        if (!grouped[c]) grouped[c] = [];
        grouped[c].push(v);
      });

      setVideosByCategory(grouped);
      setLoading(false);

      // cargar perfiles de creadores
      const ids = Array.from(
        new Set(list.map((v) => v.user_id).filter(Boolean))
      );

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
      }
    }

    loadVideos();
  }, []);

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

    // por mood del usuario
    if (c.type === "auto_mood" && viewerMood) {
      const cats = moodToCategories(viewerMood);
      if (cats.length > 0) {
        pool = pool.filter((v) => cats.includes(v.category || "otros"));
      }
    }

    // filtro por categorías específicas (si la colección las define)
    if (c.category_filter) {
      const parts = Array.isArray(c.category_filter)
        ? c.category_filter
        : c.category_filter
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      if (parts.length > 0) {
        pool = pool.filter((v) => parts.includes(v.category || "otros"));
      }
    }

    // modo infantil / seguro
    if (c.is_kids_safe) {
      pool = pool.filter((v) => v.category === "infantil");
    }

    // preview de hasta 10 videos (para auto_*)
    return pool.slice(0, 10);
  };

  /* ============================================================
     6) FUNCIÓN PARA CARGAR COLECCIONES VIVAS
     ============================================================ */
  const reloadCollections = async () => {
    if (allVideos.length === 0) return;

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

    // Mapa de videos por id
    const videoMap = {};
    allVideos.forEach((v) => {
      videoMap[v.id] = v;
    });

    // IDs de colecciones manuales / colaborativas
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
          if (!itemsByCollection[item.collection_id]) {
            itemsByCollection[item.collection_id] = [];
          }
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

  /* ============================================================
     7) EFECTO QUE USA reloadCollections
     ============================================================ */
  useEffect(() => {
    reloadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVideos, viewerMood]);

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <section className="aurevi-screen">
      <h2 className="aurevi-screen-title">Explorar</h2>
      <p className="aurevi-screen-description">
        Descubre colecciones de videos por categoría. Algunas se adaptan a tu
        estado creativo–emocional.
      </p>

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
              {recommendedCategories
                .map((c) => renderCategoryTitle(c))
                .join(", ")}
              .
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
          <h3
            style={{
              margin: 0,
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Colecciones vivas
          </h3>

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
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {collections.map((c) => {
              // 🔥 ANTES: const preview = (c.videos || []).slice(0, 3);
              // Ahora mostramos todos los videos de la colección en el preview:
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
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9ca3af",
                      }}
                    >
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

                  <h4
                    style={{
                      margin: "4px 0",
                      fontSize: 14,
                      color: "#f9fafb",
                    }}
                  >
                    {c.name || "Colección sin título"}
                  </h4>

                  {c.description && (
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: 11,
                        color: "#d1d5db",
                      }}
                    >
                      {c.description}
                    </p>
                  )}

                  {preview.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        overflowX: "auto",
                        paddingBottom: 2,
                      }}
                    >
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
      {errorMsg && (
        <p style={{ color: "#fca5a5", marginTop: 8 }}>{errorMsg}</p>
      )}

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
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {renderCategoryTitle(cat)}
                  {isRecommended && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background:
                          "linear-gradient(120deg, #22c55e, #16a34a)",
                        color: "#f9fafb",
                      }}
                    >
                      Recomendado
                    </span>
                  )}
                </h3>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                  }}
                >
                  {videos.length} video(s)
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {videos.map((video) => {
                  const creator = video.user_id
                    ? creatorProfiles[video.user_id] || null
                    : null;
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
						  height:60,
                          borderRadius: 12,
                          background: "#000",
                        }}
                      />
					  
                      <h4
                        style={{
                          margin: "6px 0 2px",
                          fontSize: 13,
                          color: "#f9fafb",
                        }}
                      >
                        {video.title || "Video sin título"}
                      </h4>
                      {video.description && (
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontSize: 11,
                            color: "#d1d5db",
                          }}
                        >
                          {video.description}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 4,
                        }}
                      >
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
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <span>
                              {video.title?.[0]?.toUpperCase() || "A"}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {creatorTrend && (
                            <span>
                              {
                                {
                                  explorador: "Explorador",
                                  constructor: "Constructor",
                                  narrador: "Narrador",
                                  musico: "Músico",
                                  mentor: "Mentor",
                                  multicreativo: "Multicreativo",
                                }[creatorTrend] || creatorTrend
                              }
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
          collection={
            editingId
              ? collections.find((c) => c.id === editingId) || null
              : null
          }
          allVideos={allVideos}
          onSaved={async () => {
            await reloadCollections();
          }}
        />
      )}
    </section>
  );
}

export default Explore;