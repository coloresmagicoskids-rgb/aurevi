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

  // ✅ Swipe state (pointer/touch)
  const swipe = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    dx: 0,
    dy: 0,
  });

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
  // Cambiar visibilidad
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
  // Borrar
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

  const title = useMemo(() => (!user ? "Álbum público" : "Álbum"), [user]);

  // ─────────────────────────────────────────────
  // Visor: abrir / cerrar / navegación
  // ─────────────────────────────────────────────
  const openViewerAt = (index) => {
    if (!photos?.length) return;
    const safe = Math.max(0, Math.min(index, photos.length - 1));
    setViewerIndex(safe);
    setViewerOpen(true);
  };

  const closeViewer = () => setViewerOpen(false);

  const goPrev = () => {
    if (!photos?.length) return;
    setViewerIndex((i) => (i - 1 + photos.length) % photos.length);
  };

  const goNext = () => {
    if (!photos?.length) return;
    setViewerIndex((i) => (i + 1) % photos.length);
  };

  // Teclado: ESC / ← / →
  useEffect(() => {
    if (!viewerOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, photos.length]);

  const activePhoto = viewerOpen ? photos[viewerIndex] : null;
  const activeUrl = activePhoto ? publicUrlFor(activePhoto.file_path) : "";

  // ─────────────────────────────────────────────
  // ✅ Acciones: descargar / compartir
  // ─────────────────────────────────────────────
  const downloadActive = async () => {
    if (!activeUrl) return;

    // Nombre sugerido
    const ext = (activePhoto?.file_path?.split(".").pop() || "jpg").toLowerCase();
    const fname = `aurevi_${activePhoto?.id || "photo"}.${ext}`;

    try {
      // Intento “real” (blob). Puede fallar por CORS en algunos setups.
      const res = await fetch(activeUrl, { mode: "cors" });
      if (!res.ok) throw new Error("No se pudo descargar (fetch).");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      setStatus("Descarga iniciada ✅");
    } catch (e) {
      // Fallback: abrir imagen (desde ahí el usuario puede guardar)
      window.open(activeUrl, "_blank", "noopener,noreferrer");
      setStatus("Abriendo imagen para descargar…");
    }
  };

  const shareActive = async () => {
    if (!activeUrl) return;

    const text = activePhoto?.caption?.trim()
      ? activePhoto.caption.trim()
      : "Foto en AUREVI";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "AUREVI",
          text,
          url: activeUrl,
        });
        setStatus("Compartido ✅");
        return;
      }

      // Fallback: copiar link
      await navigator.clipboard.writeText(activeUrl);
      setStatus("Link copiado ✅");
    } catch (e) {
      console.error(e);
      setErrorMsg("No se pudo compartir.");
    }
  };

  // ─────────────────────────────────────────────
  // ✅ Swipe handlers (pointer/touch) estilo IG
  // ─────────────────────────────────────────────
  const onPointerDown = (e) => {
    // Solo botón principal / touch
    if (e.pointerType === "mouse" && e.button !== 0) return;

    swipe.current.active = true;
    swipe.current.startX = e.clientX;
    swipe.current.startY = e.clientY;
    swipe.current.lastX = e.clientX;
    swipe.current.dx = 0;
    swipe.current.dy = 0;

    // Captura el puntero para seguir recibiendo eventos
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (!swipe.current.active) return;
    swipe.current.dx = e.clientX - swipe.current.startX;
    swipe.current.dy = e.clientY - swipe.current.startY;
    swipe.current.lastX = e.clientX;
  };

  const onPointerUp = (e) => {
    if (!swipe.current.active) return;
    swipe.current.active = false;

    const dx = swipe.current.dx;
    const dy = swipe.current.dy;

    // Umbrales (ajustables)
    const SWIPE_X = 60;     // mínimo horizontal
    const MAX_Y = 90;       // si se mueve mucho vertical, no cuenta
    const DOMINANCE = 1.2;  // horizontal debe dominar

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX >= SWIPE_X && absY <= MAX_Y && absX >= absY * DOMINANCE) {
      if (dx < 0) goNext(); // swipe izquierda -> siguiente
      else goPrev();        // swipe derecha -> anterior
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
          Estás viendo solo fotos públicas. Inicia sesión para subir y ver tus privadas.
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
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

      {loading && <p style={{ color: "#9ca3af", marginTop: 14 }}>Cargando fotos…</p>}

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
                  onClick={() => openViewerAt(idx)}
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
                <div style={{ height: 140, display: "grid", placeItems: "center", color: "#9ca3af" }}>
                  Sin imagen
                </div>
              )}

              <div style={{ padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: p.is_public ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.16)",
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
                      onClick={() => openViewerAt(idx)}
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

      {/* ✅ VISOR FULLSCREEN + SWIPE */}
      {viewerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeViewer();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0,0,0,0.86)",
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
            {/* Header visor */}
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

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={downloadActive}
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
                  ⬇ Descargar
                </button>

                <button
                  type="button"
                  onClick={shareActive}
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
                  ↗ Compartir
                </button>

                <button
                  type="button"
                  onClick={goPrev}
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
                  onClick={goNext}
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

            {/* Imagen (swipe aquí) */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                padding: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,0,0,0.20)",
                flex: 1,
                touchAction: "pan-y", // permite scroll vertical pero captura swipe horizontal con pointer
                userSelect: "none",
              }}
            >
              {activeUrl ? (
                <img
                  src={activeUrl}
                  alt={activePhoto?.caption || "Foto"}
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

            {/* Caption */}
            {(activePhoto?.caption || "").trim() && (
              <div
                style={{
                  padding: "10px 12px",
                  borderTop: "1px solid rgba(148,163,184,0.18)",
                  color: "#e5e7eb",
                  fontSize: 13,
                }}
              >
                {activePhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Album;