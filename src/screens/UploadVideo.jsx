// src/screens/UploadVideo.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useWorld } from "../worlds/WorldContext";
import { WORLD_LABELS, WORLD_DESCRIPTIONS } from "../worlds/worldTypes";

const CATEGORIES = [
  { value: "otros", label: "Otros" },
  { value: "musica", label: "Música" },
  { value: "creatividad", label: "Creatividad" },
  { value: "aprendizaje", label: "Aprendizaje" },
  { value: "bienestar", label: "Bienestar" },
  { value: "infantil", label: "Infantil / Kids" },
];

function UploadVideo() {
  const { activeWorld } = useWorld();
  const worldKey = activeWorld || "public"; // 👈 fallback seguro

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("otros");
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");

    if (!file) {
      setErrorMsg("Selecciona un archivo de video para subir.");
      return;
    }

    try {
      setUploading(true);

      // 1) Usuario actual
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setErrorMsg("Necesitas iniciar sesión para subir un video.");
        setUploading(false);
        return;
      }

      const user = userData.user;

      // 2) Subir archivo al Storage
      const ext = file.name.split(".").pop() || "mp4";
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      setStatusMsg("Subiendo archivo a AUREVI…");

      const { error: uploadError } = await supabase.storage
        .from("aurevi-videos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);
        setErrorMsg("No se pudo subir el archivo de video.");
        setUploading(false);
        return;
      }

      // 3) Obtener URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from("aurevi-videos").getPublicUrl(filePath);

      // 4) Guardar fila en la tabla videos (incluyendo el mundo)
      setStatusMsg("Guardando información del video…");

      const { error: insertError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: title || "Video sin título",
        description: description || "",
        category,
        video_url: publicUrl,
        file_path: filePath,
        world_type: worldKey, // 👈 mundo conectado a la tabla
      });

      if (insertError) {
        console.error(insertError);
        setErrorMsg("No se pudo registrar el video en la base de datos.");
        setUploading(false);
        return;
      }

      // 5) Éxito 🎉
      setStatusMsg("Tu video se subió correctamente a AUREVI.");
      setTitle("");
      setDescription("");
      setCategory("otros");
      setFile(null);
      (document.getElementById("aurevi-upload-input") || {}).value = "";
    } catch (err) {
      console.error(err);
      setErrorMsg("Ocurrió un error inesperado al subir el video.");
    } finally {
      setUploading(false);
    }
  };

  const worldLabel = WORLD_LABELS[worldKey] || "Mundo público";
  const worldDesc =
    WORLD_DESCRIPTIONS[worldKey] ||
    "Lo que compartas aquí se organizará según este mundo.";

  return (
    <section className="aurevi-screen">
      {/* Cabecera elegante de la pantalla Crear */}
      <header className="aurevi-page-header">
        <p className="aurevi-page-kicker">Crear</p>
        <h2 className="aurevi-page-title">Tu nuevo video en AUREVI</h2>
        <p className="aurevi-page-subtitle">
          Comparte algo que inspire, enseñe o acompañe a alguien. El resto lo
          hace el flujo creativo de la plataforma.
        </p>

        {/* Nueva línea: mundo actual */}
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 999,
            display: "inline-flex",
            flexDirection: "column",
            gap: 2,
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.45)",
          }}
        >
          <span style={{ opacity: 0.8 }}>Este video se guardará en:</span>
          <strong>{worldLabel}</strong>
          <span style={{ opacity: 0.8 }}>{worldDesc}</span>
        </div>
      </header>

      {/* Tarjeta principal del formulario */}
      <div className="aurevi-form-card">
        <form className="aurevi-form" onSubmit={handleSubmit}>
          {/* Título del video */}
          <label className="aurevi-label">
            Título del video
            <input
              type="text"
              className="aurevi-input"
              placeholder="Ponle un nombre corto y claro"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </label>

          {/* Descripción */}
          <label className="aurevi-label">
            Descripción
            <textarea
              className="aurevi-textarea"
              placeholder="Cuenta brevemente de qué trata tu video (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </label>

          {/* Categoría */}
          <label className="aurevi-label">
            Categoría
            <select
              className="aurevi-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {/* Archivo de video */}
          <label className="aurevi-label">
            Archivo de video
            <input
              id="aurevi-upload-input"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="aurevi-input"
              style={{ paddingTop: 7, paddingBottom: 7 }}
            />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              Formatos habituales: MP4, MOV, WEBM. Procura que el archivo no
              sea excesivamente pesado.
            </span>
          </label>

          {/* Mensajes de estado */}
          {statusMsg && (
            <p
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "#22c55e",
              }}
            >
              {statusMsg}
            </p>
          )}

          {errorMsg && (
            <p
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "#f97373",
              }}
            >
              {errorMsg}
            </p>
          )}

          {/* Botón principal */}
          <button
            type="submit"
            className="aurevi-primary-btn"
            disabled={uploading}
          >
            {uploading ? "Subiendo tu video…" : "Subir video a AUREVI"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default UploadVideo;