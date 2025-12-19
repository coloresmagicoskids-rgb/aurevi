// src/components/CollectionEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

/**
 * Props:
 * - open: boolean (si el modal está visible)
 * - onClose: () => void
 * - collection: objeto colección existente o null para crear nueva
 * - allVideos: array de todos los videos (para seleccionar en colecciones manuales/colaborativas)
 * - onSaved: (updatedCollection) => void   // opcional, para refrescar el padre después de guardar
 */
function CollectionEditor({ open, onClose, collection, allVideos, onSaved }) {
  if (!open) return null;

  const isEditing = !!collection?.id;

  // Campos básicos
  const [name, setName] = useState(collection?.name || "");
  const [description, setDescription] = useState(collection?.description || "");
  const [type, setType] = useState(collection?.type || "manual");
  const [isKidsSafe, setIsKidsSafe] = useState(!!collection?.is_kids_safe);

  // Filtro de categorías (a futuro lo podemos reactivar en el payload)
  const [categoryFilter, setCategoryFilter] = useState(() => {
    if (!collection?.category_filter) return [];
    if (Array.isArray(collection.category_filter))
      return collection.category_filter;
    if (typeof collection.category_filter === "string") {
      return collection.category_filter
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  });

  // Videos seleccionados en colecciones manual / collaborative
  const [selectedVideoIds, setSelectedVideoIds] = useState(() => {
    if (!collection?.videos || !Array.isArray(collection.videos)) return [];
    return collection.videos.map((v) => v.id);
  });

  // UI
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const categoriesOptions = [
    { value: "infantil", label: "Infantil" },
    { value: "aprendizaje", label: "Aprendizaje" },
    { value: "musica", label: "Música" },
    { value: "bienestar", label: "Bienestar" },
    { value: "creatividad", label: "Creatividad" },
    { value: "otros", label: "Otros" },
  ];

  // Filtrar videos disponibles
  const availableVideos = useMemo(() => {
    let base = allVideos || [];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q)
      );
    }
    return base;
  }, [allVideos, searchTerm]);

  // Lista de videos seleccionados con datos completos
  const selectedVideos = useMemo(() => {
    const map = {};
    (allVideos || []).forEach((v) => {
      map[v.id] = v;
    });
    return selectedVideoIds.map((id) => map[id]).filter(Boolean);
  }, [selectedVideoIds, allVideos]);

  // Sincronizar cuando cambia "collection"
  useEffect(() => {
    setName(collection?.name || "");
    setDescription(collection?.description || "");
    setType(collection?.type || "manual");
    setIsKidsSafe(!!collection?.is_kids_safe);

    if (collection?.category_filter) {
      if (Array.isArray(collection.category_filter)) {
        setCategoryFilter(collection.category_filter);
      } else if (typeof collection.category_filter === "string") {
        setCategoryFilter(
          collection.category_filter
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        );
      } else {
        setCategoryFilter([]);
      }
    } else {
      setCategoryFilter([]);
    }

    if (collection?.videos && Array.isArray(collection.videos)) {
      setSelectedVideoIds(collection.videos.map((v) => v.id));
    } else {
      setSelectedVideoIds([]);
    }

    setErrorMsg("");
    setStatusMsg("");
  }, [collection]);

  /* ==================== Handlers de selección ==================== */

  const toggleCategoryFilter = (cat) => {
    setCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addVideoToSelection = (videoId) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId) ? prev : [...prev, videoId]
    );
  };

  const removeVideoFromSelection = (videoId) => {
    setSelectedVideoIds((prev) => prev.filter((id) => id !== videoId));
  };

  const moveVideoUp = (index) => {
    if (index <= 0) return;
    setSelectedVideoIds((prev) => {
      const copy = [...prev];
      const tmp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = tmp;
      return copy;
    });
  };

  const moveVideoDown = (index) => {
    setSelectedVideoIds((prev) => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      const tmp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = tmp;
      return copy;
    });
  };

  /* ==================== Guardar en Supabase ==================== */

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    setStatusMsg("");

    if (!name.trim()) {
      setErrorMsg("La colección necesita un nombre.");
      setSaving(false);
      return;
    }

    try {
      // 1) Usuario actual (para created_by)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Error obteniendo usuario:", userError);
      }

      const userId = userData?.user?.id || null;

      if (!isEditing && !userId) {
        setErrorMsg("Necesitas iniciar sesión para crear colecciones.");
        setSaving(false);
        return;
      }

      // 2) Payload base para la tabla collections
      const basePayload = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        is_kids_safe: isKidsSafe,
        // cuando el schema esté 100% estable, podemos volver a incluir:
        // category_filter:
        //   categoryFilter && categoryFilter.length > 0 ? categoryFilter : null,
      };

      let collectionId = collection?.id || null;
      let upsertedCollection = null;

      // 3) UPDATE vs INSERT
      if (isEditing && collectionId) {
        // UPDATE (no tocamos created_by aquí)
        console.log("Actualizando colección…", basePayload);

        const { data, error } = await supabase
          .from("collections")
          .update(basePayload)
          .eq("id", collectionId)
          .select("*")
          .single();

        if (error) {
          console.error("Error actualizando colección:", error);
          setErrorMsg(
            error.message ||
              error.details ||
              "No se pudo actualizar la colección."
          );
          setSaving(false);
          return;
        }

        upsertedCollection = data;
      } else {
        // INSERT
        const newCollection = {
          ...basePayload,
          created_by: userId,
        };

        console.log("Insertando colección…", newCollection);

        const { data, error } = await supabase
          .from("collections")
          .insert(newCollection)
          .select("*")
          .single();

        if (error) {
          console.error("Error creando colección:", error);
          setErrorMsg(
            error.message ||
              error.details ||
              "No se pudo crear la colección."
          );
          setSaving(false);
          return;
        }

        upsertedCollection = data;
        collectionId = data.id;
      }

      // 4) collection_items solo para manual / collaborative
      if (collectionId && (type === "manual" || type === "collaborative")) {
        // borrar items anteriores
        await supabase
          .from("collection_items")
          .delete()
          .eq("collection_id", collectionId);

        if (selectedVideoIds.length > 0) {
          const itemsPayload = selectedVideoIds.map((videoId, idx) => ({
            collection_id: collectionId,
            video_id: videoId,
            sort_order: idx + 1,
            added_by: userId || null,
          }));

          const { error: itemsError } = await supabase
            .from("collection_items")
            .insert(itemsPayload);

          if (itemsError) {
            console.error("Error guardando collection_items:", itemsError);
            setErrorMsg(
              "La colección se guardó, pero hubo un problema con sus videos."
            );
            setSaving(false);
            return;
          }
        }
      }

      setStatusMsg("Colección guardada correctamente.");

      // limpiar formulario solo cuando es una nueva colección
      if (!isEditing) {
        setSelectedVideoIds([]);
        setName("");
        setDescription("");
      }

      if (onSaved && upsertedCollection) {
        onSaved(upsertedCollection);
      }

      // cerrar el modal un poquito después para que se vea el mensaje
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error("Error inesperado guardando colección:", err);
      setErrorMsg("Ocurrió un error inesperado al guardar la colección.");
    }

    setSaving(false);
  };

  /* ==================== Eliminar colección ==================== */

  const handleDelete = async () => {
    if (!isEditing || !collection?.id) return;

    const confirmDelete = window.confirm(
      "¿Seguro que quieres eliminar esta colección? También se eliminarán sus vínculos con videos."
    );
    if (!confirmDelete) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setStatusMsg("");

      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", collection.id);

      if (error) {
        console.error("Error eliminando colección:", error);
        setErrorMsg(
          error.message ||
            error.details ||
            "No se pudo eliminar la colección."
        );
        setSaving(false);
        return;
      }

      setStatusMsg("Colección eliminada.");

      if (onSaved) {
        onSaved(null);
      }

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error("Error inesperado eliminando colección:", err);
      setErrorMsg("Ocurrió un error inesperado al eliminar la colección.");
    } finally {
      setSaving(false);
    }
  };

  /* ==================== Render ==================== */

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "#020617",
          borderRadius: 20,
          border: "1px solid rgba(148,163,184,0.5)",
          boxShadow: "0 22px 45px rgba(0,0,0,0.8)",
          padding: 18,
          color: "#f9fafb",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#9ca3af",
              }}
            >
              {isEditing ? "Editar colección" : "Nueva colección"}
            </p>
            <h3 style={{ margin: "4px 0 0", fontSize: 18 }}>
              {isEditing ? name || "Colección sin título" : "Crea una colección viva"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: "none",
              padding: "4px 10px",
              fontSize: 12,
              background: "#111827",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>

        {/* Contenido */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 8,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {/* Nombre */}
          <label className="aurevi-label">
            Nombre de la colección
            <input
              className="aurevi-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Viajes suaves para la noche"
            />
          </label>

          {/* Descripción */}
          <label className="aurevi-label">
            Descripción
            <textarea
              className="aurevi-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cuenta brevemente de qué va esta colección."
              rows={2}
            />
          </label>

          {/* Tipo */}
          <label className="aurevi-label">
            Tipo de colección
            <select
              className="aurevi-input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="manual">Manual (eliges videos uno a uno)</option>
              <option value="collaborative">
                Colaborativa (varias personas aportan)
              </option>
              <option value="auto_mood">Automática por mood emocional</option>
              <option value="auto_time">Automática por momento del día</option>
              <option value="auto_trend">
                Automática por tu estilo creativo
              </option>
            </select>
          </label>

          {/* Modo infantil */}
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
              checked={isKidsSafe}
              onChange={(e) => setIsKidsSafe(e.target.checked)}
            />
            <span>Modo infantil / seguro para peques</span>
          </label>

          {/* Categorías filtros */}
          <div className="aurevi-label">
            <span>Categorías que alimentan esta colección</span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 6,
              }}
            >
              {categoriesOptions.map((opt) => {
                const active = categoryFilter.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleCategoryFilter(opt.value)}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      background: active
                        ? "linear-gradient(120deg, #6366f1, #ec4899)"
                        : "rgba(30,64,175,0.25)",
                      color: active ? "#f9fafb" : "#e5e7eb",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Para colecciones auto_* se usarán como “semillas” de selección.
              En manual/collaborative sirven como tag conceptual.
            </p>
          </div>

          {/* Selector de videos solo si es manual/collaborative */}
          {(type === "manual" || type === "collaborative") && (
            <>
              <div
                className="aurevi-label"
                style={{
                  borderTop: "1px solid rgba(55,65,81,0.6)",
                  paddingTop: 8,
                }}
              >
                <span>Agregar videos a la colección</span>
                <input
                  className="aurevi-input"
                  type="text"
                  placeholder="Buscar por título o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ marginTop: 4 }}
                />
                <div
                  style={{
                    marginTop: 6,
                    maxHeight: 160,
                    overflowY: "auto",
                    borderRadius: 10,
                    border: "1px solid rgba(75,85,99,0.7)",
                    padding: 6,
                    background: "rgba(15,23,42,0.8)",
                    fontSize: 12,
                  }}
                >
                  {availableVideos.length === 0 ? (
                    <p style={{ margin: 0, color: "#9ca3af" }}>
                      No hay videos que coincidan con la búsqueda.
                    </p>
                  ) : (
                    availableVideos.map((v) => {
                      const already = selectedVideoIds.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            padding: "3px 0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              maxWidth: "70%",
                            }}
                          >
                            <span>{v.title || "Sin título"}</span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                              }}
                            >
                              {v.category || "otros"}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() => addVideoToSelection(v.id)}
                            style={{
                              borderRadius: 999,
                              border: "none",
                              padding: "4px 8px",
                              fontSize: 11,
                              cursor: already ? "default" : "pointer",
                              background: already
                                ? "#1f2937"
                                : "linear-gradient(120deg,#22c55e,#16a34a)",
                              color: "#f9fafb",
                            }}
                          >
                            {already ? "Añadido" : "Agregar"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Lista de seleccionados con reordenar */}
              <div className="aurevi-label">
                <span>Videos en esta colección (orden manual)</span>
                {selectedVideos.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                    Aún no has añadido videos. Elige algunos de la lista de
                    arriba.
                  </p>
                ) : (
                  <div
                    style={{
                      marginTop: 6,
                      borderRadius: 10,
                      border: "1px solid rgba(75,85,99,0.7)",
                      padding: 6,
                      background: "rgba(15,23,42,0.8)",
                      maxHeight: 180,
                      overflowY: "auto",
                      fontSize: 12,
                    }}
                  >
                    {selectedVideos.map((v, idx) => (
                      <div
                        key={v.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "4px 0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            maxWidth: "70%",
                          }}
                        >
                          <span style={{ opacity: 0.6 }}>{idx + 1}.</span>
                          <span>{v.title || "Sin título"}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => moveVideoUp(idx)}
                            style={{
                              borderRadius: 999,
                              border: "none",
                              padding: "2px 6px",
                              fontSize: 11,
                              cursor: "pointer",
                              background: "#111827",
                              color: "#e5e7eb",
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveVideoDown(idx)}
                            style={{
                              borderRadius: 999,
                              border: "none",
                              padding: "2px 6px",
                              fontSize: 11,
                              cursor: "pointer",
                              background: "#111827",
                              color: "#e5e7eb",
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVideoFromSelection(v.id)}
                            style={{
                              borderRadius: 999,
                              border: "none",
                              padding: "2px 6px",
                              fontSize: 11,
                              cursor: "pointer",
                              background: "#b91c1c",
                              color: "#f9fafb",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Mensajes */}
          {errorMsg && (
            <p
              style={{
                color: "#fca5a5",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              {errorMsg}
            </p>
          )}
          {statusMsg && (
            <p
              style={{
                color: "#4ade80",
                fontSize: 14,
                margin: "8px 0",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              {statusMsg}
            </p>
          )}

          {/* Botones finales */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 8,
              alignItems: "center",
            }}
          >
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                style={{
                  borderRadius: 999,
                  border: "none",
                  padding: "6px 10px",
                  fontSize: 12,
                  background: "#7f1d1d",
                  color: "#fee2e2",
                  cursor: saving ? "default" : "pointer",
                }}
              >
                Eliminar colección
              </button>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="aurevi-primary-btn"
                style={{
                  background: "#111827",
                  color: "#e5e7eb",
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="aurevi-primary-btn"
                disabled={saving}
              >
                {saving
                  ? isEditing
                    ? "Guardando cambios..."
                    : "Creando colección..."
                  : isEditing
                  ? "Guardar cambios"
                  : "Crear colección"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollectionEditor;