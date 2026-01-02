// src/screens/Album.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

function Album() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ✅ Visor (lightbox)
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ✅ Fullscreen API (pantalla completa real)
  const viewerOverlayRef = useRef(null);
  const wantsFullscreenRef = useRef(false);

  // ✅ Swipe (touch)
  const touchStartRef = useRef({ x: 0, y: 0, t: 0 });
  const touchMovedRef = useRef(false);

  // ─────────────────────────────────────────────
  // Init: usuario
  // ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingUser(true);
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error(error);
      setUser(data?.user || null);
      setLoadingUser(false);
    })();
  }, []);

  // ─────────────────────────────────────────────
  // Cargar fotos
  // ─────────────────────────────────────────────
  const loadPhotos = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase
        .from("album_photos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudieron cargar las fotos.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const publicUrlFor = (filePath) => {
    if (!filePath) return "";
    const { data } = supabase.storage.from("aurevi-photos").getPublicUrl(filePath);
    return data?.publicUrl || "";
  };

  const canEdit = (p) => user?.id && p?.user_id === user.id;

  // ─────────────────────────────────────────────
  // Subir foto
  // ─────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!user) {
      setErrorMsg("Inicia sesión para subir fotos.");
      return;
    }

    setUploading(true);
    setStatus("");
    setErrorMsg("");

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now());

      const filePath = `${user.id}/${safeId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("aurevi-photos")
        .upload(filePath, file, { upsert: false });

      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("album_photos").insert({
        user_id: user.id,
        file_path: filePath,
        caption: caption?.trim() || null,
        is_public: !!isPublic,
      });

      if (dbErr) throw dbErr;

      setCaption("");
      setIsPublic(false);
      setStatus("Foto subida ✅");
      await loadPhotos();
    } catch (err) {
      console.error(err);
      setErrorMsg(err?.message || "No se pudo subir la foto.");
    }

    setUploading(false);
  };

  // ─────────────────────────────────────────────
  // Cambiar visibilidad (solo dueño)
  // ─────────────────────────────────────────────
  const toggleVisibility = async (photo) => {
    if (!canEdit(photo)) return;

    setStatus("");
    setErrorMsg("");

    try {
      const { error } = await supabase
        .from("album_photos")
        .update({ is_public: !photo.is_public })
        .eq("id", photo.id);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, is_public: !p.is_public } : p
        )
      );
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudo cambiar la visibilidad.");
    }
  };

  // ─────────────────────────────────────────────
  // Borrar (solo dueño)
  // ─────────────────────────────────────────────
  const deletePhoto = async (photo) => {
    if (!canEdit(photo)) return;

    const ok = window.confirm("¿Eliminar esta foto del álbum?");
    if (!ok) return;

    setStatus("");
    setErrorMsg("");

    try {
      const { error: dbErr } = await supabase
        .from("album_photos")
        .delete()
        .eq("id", photo.id);

      if (dbErr) throw dbErr;

      if (photo.file_path) {
        await supabase.storage.from("aurevi-photos").remove([photo.file_path]);
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setStatus("Foto eliminada 🗑️");
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudo eliminar la foto.");
    }
  };

  const title = useMemo(() => {
    if (!user) return "Álbum público";
    return "Álbum";
  }, [user]);

  // ─────────────────────────────────────────────
  // ✅ Visor: abrir / cerrar / navegación
  // ─────────────────────────────────────────────
  const openViewerAt = (index, tryFullscreen = true) => {
    if (!photos?.length) return;
    const safe = Math.max(0, Math.min(index, photos.length - 1));
    setViewerIndex(safe);
    wantsFullscreenRef.current = !!tryFullscreen;
    setViewerOpen(true);
  };

  const closeViewer = async () => {
    setViewerOpen(false);

    // Si está en fullscreen, salimos al cerrar
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const goPrev = () => {
    if (!photos?.length) return;
    setViewerIndex((i) => (i - 1 + photos.length) % photos.length);
  };

  const goNext = () => {
    if (!photos?.length) return;
    setViewerIndex((i) => (i + 1) % photos.length);
  };

  // ✅ Ajustar índice si cambia el listado (ej. borraste una foto)
  useEffect(() => {
    if (!viewerOpen) return;
    if (!photos?.length) {
      setViewerOpen(false);
      return;
    }
    setViewerIndex((i) => Math.max(0, Math.min(i, photos.length - 1)));
  }, [photos.length, viewerOpen]);

  // Teclado: ESC / ← / →
  useEffect(() => {
    if (!viewerOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKey);

    // Evita scroll del body cuando el visor está abierto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, photos.length]);

  // ✅ Entrar a pantalla completa real al abrir el visor (si el usuario lo inició con click)
  useEffect(() => {
    if (!viewerOpen) return;

    const tryEnter = async () => {
      if (!wantsFullscreenRef.current) return;
      const el = viewerOverlayRef.current;
      if (!el) return;

      try {
        if (!document.fullscreenElement && el.requestFullscreen) {
          await el.requestFullscreen();
        }
      } catch {
        // En algunos navegadores puede fallar si no fue gesto del usuario
      }
    };

    // un tick para asegurar que el overlay exista
    const id = requestAnimationFrame(tryEnter);
    return () => cancelAnimationFrame(id);
  }, [viewerOpen]);

  const activePhoto = viewerOpen ? photos[viewerIndex] : null;
  const activeUrl = activePhoto ? publicUrlFor(activePhoto.file_path) : "";

  // ─────────────────────────────────────────────
  // ✅ Swipe handlers (móvil)
  // ─────────────────────────────────────────────
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchMovedRef.current = false;
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchMove = (e) => {
    // marcamos que hubo movimiento para evitar clicks accidentales
    touchMovedRef.current = true;
  };

  const onTouchEnd = (e) => {
    const start = touchStartRef.current;
    const changed = e.changedTouches?.[0];
    if (!changed) return;

    const dx = changed.clientX - start.x;
    const dy = changed.clientY - start.y;
    const dt = Date.now() - start.t;

    // Condiciones típicas de swipe: rápido y más horizontal que vertical
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (dt < 600 && absX > 40 && absX > absY * 1.2) {
      if (dx > 0) goPrev();
      else goNext();
    }
  };

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  if (loadingUser) {
    return (
      <section className="aurevi-screen">
        <h2 className="aurevi-screen-title">Álbum</h2>
        <p style={{ color: "#9ca3af" }}>Cargando…</p>
      </section>
    );
  }

  return (
    <section className="aurevi-screen">
      <div className="aurevi-screen-header">
        <h2 className="aurevi-screen-title">{title}</h2>
        <p className="aurevi-screen-description">
          Guarda tus fotos y decide si son públicas o privadas.
        </p>
      </div>

      {!user && (
        <p style={{ color: "#fbbf24", marginTop: 10 }}>
          Estás viendo solo fotos públicas. Inicia sesión para subir y ver tus
          privadas.
        </p>
      )}

      {user && (
        <div
          className="aurevi-feed-card"
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.55)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              style={{ flex: "1 1 220px" }}
            />

            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Descripción (opcional)"
              disabled={uploading}
              style={{
                flex: "2 1 260px",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(2,6,23,0.6)",
                color: "#e5e7eb",
              }}
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={uploading}
              />
              Hacer pública
            </label>
          </div>

          <p style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
            Sube una foto y marca si es pública. (Luego podrás cambiarlo.)
          </p>
        </div>
      )}

      {status && <p style={{ color: "#86efac", marginTop: 10 }}>{status}</p>}
      {errorMsg && <p style={{ color: "#fca5a5", marginTop: 10 }}>{errorMsg}</p>}

      {loading && (
        <p style={{ color: "#9ca3af", marginTop: 14 }}>Cargando fotos…</p>
      )}

      {!loading && photos.length === 0 && (
        <p style={{ color: "#9ca3af", marginTop: 14 }}>
          No hay fotos todavía. Sube la primera 🙂
        </p>
      )}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {photos.map((p, idx) => {
          const url = publicUrlFor(p.file_path);
          const mine = canEdit(p);

          return (
            <div
              key={p.id}
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(2,6,23,0.6)",
              }}
            >
              {url ? (
                <button
                  type="button"
                  onClick={() => openViewerAt(idx, true)}
                  title="Ver"
                  style={{
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    width: "100%",
                    cursor: "zoom-in",
                    display: "block",
                  }}
                >
                  <img
                    src={url}
                    alt={p.caption || "Foto"}
                    style={{ width: "100%", height: 140, objectFit: "cover" }}
                    loading="lazy"
                  />
                </button>
              ) : (
                <div
                  style={{
                    height: 140,
                    display: "grid",
                    placeItems: "center",
                    color: "#9ca3af",
                  }}
                >
                  Sin imagen
                </div>
              )}

              <div style={{ padding: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: p.is_public
                        ? "rgba(34,197,94,0.18)"
                        : "rgba(239,68,68,0.16)",
                      color: p.is_public ? "#86efac" : "#fca5a5",
                      border: "1px solid rgba(148,163,184,0.15)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.is_public ? "🌐 Pública" : "🔒 Privada"}
                  </span>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => openViewerAt(idx, true)}
                      style={{
                        fontSize: 11,
                        borderRadius: 999,
                        padding: "4px 8px",
                        border: "1px solid rgba(148,163,184,0.25)",
                        background: "rgba(15,23,42,0.55)",
                        color: "#e5e7eb",
                        cursor: "pointer",
                      }}
                    >
                      Ver
                    </button>

                    {mine && (
                      <button
                        type="button"
                        onClick={() => toggleVisibility(p)}
                        style={{
                          fontSize: 11,
                          borderRadius: 999,
                          padding: "4px 8px",
                          border: "1px solid rgba(148,163,184,0.25)",
                          background: "rgba(15,23,42,0.55)",
                          color: "#e5e7eb",
                          cursor: "pointer",
                        }}
                      >
                        Cambiar
                      </button>
                    )}
                  </div>
                </div>

                {p.caption && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#e5e7eb" }}>
                    {p.caption}
                  </div>
                )}

                {mine && (
                  <button
                    type="button"
                    onClick={() => deletePhoto(p)}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      fontSize: 12,
                      borderRadius: 10,
                      padding: "8px 10px",
                      border: "none",
                      background: "rgba(239,68,68,0.9)",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────
          ✅ VISOR PANTALLA COMPLETA (con fullscreen + swipe)
         ───────────────────────────────────────────── */}
      {viewerOpen && (
        <div
          ref={viewerOverlayRef}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeViewer();
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0,0,0,0.92)",
            display: "grid",
            placeItems: "center",
            padding: 12,
            touchAction: "pan-y", // permite scroll vertical fuera, pero swipe horizontal se detecta
          }}
        >
          {/* Contenedor */}
          <div
            style={{
              width: "min(1200px, 100%)",
              height: "min(92vh, 900px)",
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(2,6,23,0.92)",
              overflow: "hidden",
              position: "relative",
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
            }}
          >
            {/* Barra superior */}
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
                {photos.length > 0 ? (
                  <>
                    <strong style={{ color: "#fff" }}>
                      {viewerIndex + 1}/{photos.length}
                    </strong>
                    {activePhoto?.is_public ? " · 🌐 Pública" : " · 🔒 Privada"}
                  </>
                ) : (
                  "Visor"
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Fullscreen toggle */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (document.fullscreenElement) {
                        await document.exitFullscreen();
                      } else if (viewerOverlayRef.current?.requestFullscreen) {
                        await viewerOverlayRef.current.requestFullscreen();
                      }
                    } catch {
                      // ignore
                    }
                  }}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(15,23,42,0.55)",
                    color: "#e5e7eb",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                  title="Pantalla completa"
                >
                  ⛶
                </button>

                <button
                  type="button"
                  onClick={closeViewer}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(239,68,68,0.9)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                  title="Cerrar (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Imagen */}
            <div
              style={{
                position: "relative",
                background: "rgba(0,0,0,0.25)",
                display: "grid",
                placeItems: "center",
                padding: 12,
              }}
            >
              {/* Botón Prev (flotante) */}
              <button
                type="button"
                onClick={goPrev}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(15,23,42,0.55)",
                  color: "#e5e7eb",
                  borderRadius: 999,
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontSize: 14,
                  userSelect: "none",
                }}
                aria-label="Anterior"
                title="Anterior (←)"
              >
                ←
              </button>

              {/* Botón Next (flotante) */}
              <button
                type="button"
                onClick={goNext}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "1px solid rgba(148,163,184,0.25)",
                  background: "rgba(15,23,42,0.55)",
                  color: "#e5e7eb",
                  borderRadius: 999,
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontSize: 14,
                  userSelect: "none",
                }}
                aria-label="Siguiente"
                title="Siguiente (→)"
              >
                →
              </button>

              {activeUrl ? (
                <img
                  src={activeUrl}
                  alt={activePhoto?.caption || "Foto"}
                  style={{
                    width: "100%",
                    height: "100%",
                    maxHeight: "68vh",
                    objectFit: "contain",
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.18)",
                    background: "rgba(0,0,0,0.25)",
                  }}
                  draggable={false}
                />
              ) : (
                <div style={{ color: "#9ca3af" }}>Sin imagen</div>
              )}
            </div>

            {/* Caption */}
            {(activePhoto?.caption || "").trim() ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderTop: "1px solid rgba(148,163,184,0.18)",
                  color: "#e5e7eb",
                  fontSize: 13,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ opacity: 0.95 }}>{activePhoto.caption}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                  Swipe / ← → / Esc
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "10px 12px",
                  borderTop: "1px solid rgba(148,163,184,0.18)",
                  color: "#9ca3af",
                  fontSize: 11,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                Swipe / ← → / Esc
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Album;