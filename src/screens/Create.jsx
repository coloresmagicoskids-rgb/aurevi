// src/screens/Create.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import CameraRecorder from "../components/CameraRecorder.jsx";
import { useWorld } from "../worlds/WorldContext";

function Create() {
  const worldCtx = useWorld();
  const activeWorld = worldCtx?.activeWorld ?? "mundo";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState(null);

  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Categoria (evita pantalla blanca)
  const [category, setCategory] = useState("otros");

  // Modos
  const [mode, setMode] = useState("upload"); // upload | record
  const [cameraMode, setCameraMode] = useState("normal"); // normal | dueto
  const [recordDuration, setRecordDuration] = useState(60);

  // Preview
  const [previewUrl, setPreviewUrl] = useState("");

  // Dueto
  const [duetStep, setDuetStep] = useState(1);
  const [duetFirstFile, setDuetFirstFile] = useState(null);
  const [duetGroupId, setDuetGroupId] = useState(null);

  // Misión (opcional)
  const [personalMission, setPersonalMission] = useState(null);

  // ✅ Límite recomendado (ajústalo si cambias plan/policies)
  const MAX_MB = 45;

  const hasBasicInfo = title.trim().length > 0;
  const hasVideo = !!videoFile;
  const currentStep = !hasBasicInfo ? 1 : !hasVideo ? 2 : 3;

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

  // ✅ Helpers tamaño
  const mbOf = (file) => (file?.size || 0) / (1024 * 1024);

  const formatMB = (file) => {
    if (!file?.size) return "0.0 MB";
    return `${mbOf(file).toFixed(1)} MB`;
  };

  const validateSizeOrThrow = (file) => {
    const size = mbOf(file);
    if (size > MAX_MB) {
      throw new Error(
        `El video pesa ${size.toFixed(1)} MB. El máximo permitido es ${MAX_MB} MB. ` +
          `Consejo: grábalo en 720p, recórtalo o comprímelo.`
      );
    }
  };

  const resetVideoState = () => {
    setVideoFile(null);
    setPreviewUrl("");
    setDuetStep(1);
    setDuetFirstFile(null);
    setDuetGroupId(null);
  };

  // ✅ Preview URL
  useEffect(() => {
    if (!videoFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  // ✅ Cargar misión (si existe) — no debe tumbar la pantalla si falla
  useEffect(() => {
    async function loadMission() {
      try {
        const { data: u } = await supabase.auth.getUser();
        const user = u?.user;
        if (!user) return;

        const { data: rows, error } = await supabase
          .from("video_analysis")
          .select("mood_detected, advice, created_at, video:video_id(user_id)")
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) return;

        const mine = (rows || []).find((r) => r.video && r.video.user_id === user.id);
        if (!mine) return;

        setPersonalMission({
          mood_detected: mine.mood_detected,
          advice: mine.advice,
          created_at: mine.created_at,
        });
      } catch {
        // silencioso
      }
    }
    loadMission();
  }, []);

  const handleFileChange = (event) => {
    try {
      const file = event.target.files?.[0] || null;

      setStatus("");
      setErrorMsg("");

      // reset dueto
      setDuetStep(1);
      setDuetFirstFile(null);
      setDuetGroupId(null);

      if (!file) {
        resetVideoState();
        return;
      }

      // ✅ valida tamaño ANTES de seleccionar
      validateSizeOrThrow(file);
      setVideoFile(file);
    } catch (e) {
      resetVideoState();
      setErrorMsg(e?.message || "El archivo es demasiado grande.");
    }
  };

  const handleCameraVideoReady = (file) => {
    setStatus("");
    setErrorMsg("");

    // ✅ valida tamaño ANTES de aceptar el video grabado
    try {
      validateSizeOrThrow(file);
    } catch (e) {
      resetVideoState();
      setErrorMsg(e?.message || "El video grabado es demasiado grande.");
      return;
    }

    if (cameraMode === "dueto") {
      if (duetStep === 1) {
        const groupId =
          duetGroupId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setDuetGroupId(groupId);
        setDuetFirstFile(file);
        setVideoFile(file); // preview parte 1
        setDuetStep(2);
        setStatus("Primera toma lista. Ahora graba la respuesta (parte 2).");
      } else {
        setVideoFile(file); // preview parte 2
        setStatus("Segunda toma lista. Listo para subir el dueto.");
      }
    } else {
      setDuetStep(1);
      setDuetFirstFile(null);
      setDuetGroupId(null);
      setVideoFile(file);
      setStatus("Clip listo para subir.");
    }
  };

  /**
   * ✅ SUPER IMPORTANTE:
   * - Si el profile YA existe, NO hacemos upsert (para que no falle por RLS).
   * - Solo intentamos crearlo si no existe.
   */
  const ensureProfileExists = async (user) => {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing?.id) return;

    const payload = { id: user.id, updated_at: new Date().toISOString() };

    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (upErr) {
      throw new Error(
        "No se pudo crear/asegurar tu perfil en profiles. " +
          "Probable RLS bloqueando INSERT/UPSERT en profiles. " +
          "Detalle: " +
          upErr.message
      );
    }
  };

  const analyzeVideo = async (videoId) => {
    if (!videoId) return;
    try {
      const { error } = await supabase.functions.invoke("analyze-video", {
        body: { video_id: videoId },
      });
      if (error) console.warn("analyze-video error:", error);
    } catch (e) {
      console.warn("analyze-video exception:", e);
    }
  };

  // ✅ Debug helper (para comparar TU cuenta vs suscriptor)
  const debugEnvAndSession = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      console.log("ENV URL", url);
      console.log(
        "ENV ANON KEY?",
        !!key,
        key ? `(len=${String(key).length})` : "(missing)"
      );

      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      const session = sessData?.session || null;
      console.log("SESSION?", !!session, session?.user?.id);
      if (sessErr) console.log("SESSION ERROR", sessErr);

      return session;
    } catch (e) {
      console.log("DEBUG ENV/SESSION EXCEPTION", e);
      return null;
    }
  };

  const fileSizeUi = useMemo(() => {
    if (!videoFile) return null;
    const size = mbOf(videoFile);
    const warn = size > MAX_MB;
    return { size, warn, label: `${size.toFixed(1)} MB` };
  }, [videoFile]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");
    setErrorMsg("");

    if (!videoFile) {
      setErrorMsg("Selecciona un archivo de video (o grábalo).");
      return;
    }

    // ✅ seguridad extra: si por algo entró un archivo grande, lo frenamos aquí también
    try {
      validateSizeOrThrow(videoFile);
      if (cameraMode === "dueto" && duetFirstFile) validateSizeOrThrow(duetFirstFile);
    } catch (e) {
      setErrorMsg(e?.message || "El video es demasiado grande.");
      return;
    }

    if (cameraMode === "dueto" && (!duetFirstFile || duetStep !== 2)) {
      setErrorMsg("En modo dueto necesitas grabar la parte 1 y luego la parte 2.");
      return;
    }

    setLoading(true);

    try {
      // ✅ Logs globales del intento de subida (clave para el “Failed to fetch”)
      await debugEnvAndSession();

      const { data: u, error: userError } = await supabase.auth.getUser();
      const user = u?.user;

      if (userError || !user) {
        setErrorMsg("Debes iniciar sesión para subir videos a AUREVI.");
        setLoading(false);
        return;
      }

      // ✅ Asegura profile (sin romper si ya existe)
      await ensureProfileExists(user);

      const uploadAndInsert = async (file, duetStepValue = null, groupId = null) => {
        const BUCKET = "aurevi-videos";

        const fileName = file?.name || "video.mp4";
        const fileExt = fileName.includes(".") ? fileName.split(".").pop() : "mp4";

        const filePath = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${fileExt}`;

        // ✅ Debug del archivo
        console.log("UPLOAD PREP", {
          bucket: BUCKET,
          filePath,
          name: file?.name,
          size: file?.size,
          type: file?.type,
          lastModified: file?.lastModified,
          world: activeWorld,
          category,
          cameraMode,
          duetStepValue,
          groupId,
        });

        // 1) Upload storage (con try/catch para capturar “Failed to fetch” real)
        let uploadRes;
        try {
          uploadRes = await supabase.storage.from(BUCKET).upload(filePath, file, {
            upsert: false,
            contentType: file?.type || "video/mp4",
          });
        } catch (e) {
          console.log("UPLOAD THROW (network/fetch/CORS?)", e);
          throw new Error(
            "Storage bloqueó la subida: Failed to fetch (red/CORS/URL/SSL). " +
              "Revisa consola del navegador del suscriptor."
          );
        }

        const { data, error: uploadError } = uploadRes || {};
        console.log("UPLOAD RESULT", { data, error: uploadError });

        if (uploadError) {
          throw new Error("Storage bloqueó la subida: " + uploadError.message);
        }

        // 2) URL pública (temporal)
        const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        const publicUrl = publicData?.publicUrl;
        console.log("PUBLIC URL", publicUrl);

        // 3) Insert DB
        const payload = {
          title: title || null,
          description: description || null,
          video_url: publicUrl,
          file_path: filePath,
          user_id: user.id,
          category,
          camera_mode: cameraMode || null,
          world_type: activeWorld,
        };

        if (duetStepValue != null) {
          payload.duet_step = duetStepValue;
          payload.duet_group_id =
            groupId ||
            duetGroupId ||
            `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        console.log("DB INSERT payload", payload);

        const { data: inserted, error: dbError } = await supabase
          .from("videos")
          .insert(payload)
          .select("id")
          .single();

        console.log("DB INSERT result", { inserted, dbError });

        if (dbError) {
          throw new Error("DB bloqueó el insert en videos: " + dbError.message);
        }

        return inserted?.id;
      };

      let mainVideoId = null;

      if (cameraMode === "dueto") {
        const ensuredGroupId =
          duetGroupId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setDuetGroupId(ensuredGroupId);

        await uploadAndInsert(duetFirstFile, 1, ensuredGroupId);
        mainVideoId = await uploadAndInsert(videoFile, 2, ensuredGroupId);

        setStatus("Dueto subido correctamente a AUREVI.");
      } else {
        mainVideoId = await uploadAndInsert(videoFile, null, null);
        setStatus("Video subido correctamente a AUREVI.");
      }

      if (mainVideoId) await analyzeVideo(mainVideoId);

      // Reset
      setTitle("");
      setDescription("");
      resetVideoState();
    } catch (err) {
      console.error(err);
      setErrorMsg(err?.message || "Ocurrió un error inesperado al subir el video.");
    }

    setLoading(false);
  };

  return (
    <section className="aurevi-screen">
      <h2 className="aurevi-screen-title">Crear</h2>
      <p className="aurevi-screen-description">
        Sube tu video o grábalo directamente desde AUREVI.
      </p>

      {/* Barra de pasos */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, fontSize: 12 }}>
        {[
          { step: 1, label: "Idea y detalles" },
          { step: 2, label: "Video y formato" },
          { step: 3, label: "Revisar y publicar" },
        ].map((s) => {
          const isActive = currentStep === s.step;
          const isDone = currentStep > s.step;
          return (
            <div
              key={s.step}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.45)",
                background: isActive
                  ? "linear-gradient(120deg,#4f46e5,#0ea5e9)"
                  : isDone
                  ? "rgba(22,163,74,0.2)"
                  : "rgba(15,23,42,0.9)",
                color: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  background: "rgba(15,23,42,0.85)",
                }}
              >
                {isDone ? "✓" : s.step}
              </span>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  opacity: isActive ? 1 : 0.8,
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="aurevi-form-card">
        <h3 className="aurevi-form-title">Crear video</h3>

        {personalMission && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(15,23,42,0.98)",
              border: "1px solid rgba(148,163,184,0.5)",
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
              Misión creativa basada en tus últimos videos
            </div>
            <div style={{ fontSize: 11, marginBottom: 3, color: "#e5e7eb" }}>
              Clima detectado:{" "}
              <strong>{renderMoodLabel(personalMission.mood_detected)}</strong>
            </div>
            {personalMission.advice && (
              <div style={{ color: "#e5e7eb" }}>{personalMission.advice}</div>
            )}
          </div>
        )}

        <div className="profile-mode-toggle" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={"profile-mode-btn" + (mode === "upload" ? " active" : "")}
            onClick={() => {
              setMode("upload");
              setStatus("");
              setErrorMsg("");
            }}
          >
            Subir archivo
          </button>
          <button
            type="button"
            className={"profile-mode-btn" + (mode === "record" ? " active" : "")}
            onClick={() => {
              setMode("record");
              setStatus("");
              setErrorMsg("");
            }}
          >
            Grabar con cámara
          </button>
        </div>

        <form className="aurevi-form" onSubmit={handleSubmit}>
          <label className="aurevi-label">
            Título
            <input
              className="aurevi-input"
              type="text"
              placeholder="Ej: Mi primer video en AUREVI"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="aurevi-label">
            Descripción
            <textarea
              className="aurevi-textarea"
              placeholder="Cuenta brevemente de qué trata tu video."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="aurevi-label">
            Categoría
            <select
              className="aurevi-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="infantil">Infantil</option>
              <option value="aprendizaje">Aprendizaje</option>
              <option value="bienestar">Bienestar</option>
              <option value="musica">Música</option>
              <option value="creatividad">Creatividad</option>
              <option value="otros">Otros</option>
            </select>
          </label>

          {mode === "upload" && (
            <label className="aurevi-label">
              Archivo de video
              <input
                className="aurevi-input"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
              />
              <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Paso 2 · Elige el archivo.
              </span>

              {/* ✅ info de tamaño */}
              <div style={{ fontSize: 11, color: "rgba(156,163,175,0.9)", marginTop: 6 }}>
                Límite por video: <strong>{MAX_MB} MB</strong>
                {videoFile ? (
                  <>
                    {" · "}Tamaño actual:{" "}
                    <strong style={{ color: fileSizeUi?.warn ? "#fca5a5" : "#a7f3d0" }}>
                      {formatMB(videoFile)}
                    </strong>
                  </>
                ) : null}
              </div>
            </label>
          )}

          {mode === "record" && (
            <div className="aurevi-label">
              <span>Grabar desde tu cámara</span>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setCameraMode("normal")}
                  style={{
                    borderRadius: 999,
                    border: "none",
                    padding: "6px 12px",
                    cursor: "pointer",
                    background: cameraMode === "normal" ? "#4f46e5" : "rgba(55,65,81,0.8)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraMode("dueto");
                    setDuetStep(1);
                    setDuetFirstFile(null);
                    setDuetGroupId(null);
                  }}
                  style={{
                    borderRadius: 999,
                    border: "none",
                    padding: "6px 12px",
                    cursor: "pointer",
                    background: cameraMode === "dueto" ? "#f97316" : "rgba(55,65,81,0.8)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                >
                  Dueto
                </button>
              </div>

              {cameraMode === "dueto" && (
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                  Dueto: paso {duetStep} de 2
                </p>
              )}

              {/* ✅ hint de límite */}
              <p style={{ fontSize: 11, color: "rgba(156,163,175,0.9)", marginTop: 8, marginBottom: 0 }}>
                Límite por video: <strong>{MAX_MB} MB</strong>.
              </p>

              <CameraRecorder
                onVideoReady={handleCameraVideoReady}
                maxDurationSec={recordDuration}
                themeMode={cameraMode}
              />
            </div>
          )}

          {videoFile && previewUrl && (
            <div className="aurevi-label">
              <span>Previsualización del clip</span>
              <video
                src={previewUrl}
                className="aurevi-video-player"
                controls
                style={{ marginTop: 8, maxHeight: 260 }}
              />
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  fontSize: 12,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="aurevi-camera-btn-secondary"
                  onClick={() => {
                    resetVideoState();
                    setStatus("");
                    setErrorMsg("");
                  }}
                >
                  Volver a grabar / elegir otro
                </button>

                <span style={{ color: "#9ca3af" }}>Si te gusta, pulsa “Subir video”.</span>

                {/* ✅ tamaño visible también aquí */}
                <span style={{ color: fileSizeUi?.warn ? "#fca5a5" : "#a7f3d0" }}>
                  Tamaño: <strong>{formatMB(videoFile)}</strong> (máx {MAX_MB} MB)
                </span>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              marginBottom: 8,
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.4)",
              background: "rgba(15,23,42,0.9)",
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#9ca3af",
              }}
            >
              Ficha del clip
            </div>
            <p style={{ margin: 0, color: "#e5e7eb" }}>
              <strong>Título:</strong> {title.trim() || "Aún no has escrito el título."}
            </p>
            <p style={{ margin: "2px 0 0", color: "#e5e7eb" }}>
              <strong>Categoría:</strong> {category}
            </p>
            <p style={{ margin: "2px 0 0", color: "#e5e7eb" }}>
              <strong>Modo cámara:</strong> {cameraMode}
            </p>
            <p style={{ margin: "2px 0 0", color: "#e5e7eb" }}>
              <strong>Mundo:</strong> {activeWorld}
            </p>
            <p style={{ margin: "2px 0 0", color: "#e5e7eb" }}>
              <strong>Estado:</strong>{" "}
              {!hasBasicInfo
                ? "Completa el título."
                : !hasVideo
                ? "Falta elegir o grabar el video."
                : "Listo para publicar."}
            </p>
          </div>

          {status && <p style={{ color: "#4ade80", fontSize: 14, marginTop: 4 }}>{status}</p>}
          {errorMsg && <p style={{ color: "#fca5a5", fontSize: 14, marginTop: 4 }}>{errorMsg}</p>}

          <button type="submit" className="aurevi-primary-btn" disabled={loading}>
            {loading ? "Subiendo..." : "Subir video"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Create;