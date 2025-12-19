// src/components/CameraRecorder.jsx
import React, { useEffect, useRef, useState } from "react";

function CameraRecorder({
  onVideoReady,
  maxDurationSec,
  themeMode = "normal", // "normal" | "cuento_infantil" | "mindful" | "aprendizaje" | "dueto"
}) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Enciende la cámara para empezar.");
  const [elapsed, setElapsed] = useState(0);

  // ===================== MODOS TEMÁTICOS =====================
  const isCuentoInfantil = themeMode === "cuento_infantil";
  const isMindful = themeMode === "mindful";
  const isAprendizaje = themeMode === "aprendizaje";
  const isDueto = themeMode === "dueto";

  let overlayStyle = null;
  let modeLabel = null;
  let modeHint = null;

  if (isCuentoInfantil) {
    modeLabel = "Modo cuento infantil";
    modeHint =
      "Piensa en una escena cálida, cercana, como si le hablaras a una niña o niño curioso.";
    overlayStyle = {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "radial-gradient(circle at 10% 0%, rgba(251,191,36,0.25), transparent 55%), radial-gradient(circle at 90% 100%, rgba(244,114,182,0.22), transparent 55%)",
      boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)",
      borderRadius: 16,
    };
  } else if (isMindful) {
    modeLabel = "Modo mindful";
    modeHint =
      "Respira profundo, deja pequeñas pausas entre frases. Aquí importa más la calma que la perfección.";
    overlayStyle = {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "radial-gradient(circle at 20% 10%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(circle at 80% 90%, rgba(45,212,191,0.22), transparent 55%)",
      boxShadow: "inset 0 0 36px rgba(0,0,0,0.45)",
      borderRadius: 16,
    };
  } else if (isAprendizaje) {
    modeLabel = "Modo aprendizajes";
    modeHint =
      "Imagina que enseñas algo a una sola persona. Explica en pasos, con ejemplos cortos.";
    overlayStyle = {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "linear-gradient(135deg, rgba(129,140,248,0.22), rgba(59,130,246,0.16))",
      boxShadow: "inset 0 0 30px rgba(15,23,42,0.8)",
      borderRadius: 16,
    };
  } else if (isDueto) {
    modeLabel = "Modo dueto emocional";
    modeHint =
      "Idea: hoy grabas una parte, en el futuro grabas la respuesta. Mira a lados distintos en cada toma.";
    overlayStyle = {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "repeating-linear-gradient(90deg, rgba(15,23,42,0.7), rgba(15,23,42,0.7) 1px, transparent 1px, transparent 50%), radial-gradient(circle at 0% 50%, rgba(248,113,113,0.25), transparent 60%), radial-gradient(circle at 100% 50%, rgba(96,165,250,0.25), transparent 60%)",
      backgroundSize: "4px 100%, auto, auto",
      boxShadow: "inset 0 0 34px rgba(0,0,0,0.8)",
      borderRadius: 16,
    };
  }

  // ===================== CÁMARA =====================

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatus("Cámara lista. Puedes empezar a grabar.");
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      setStatus("No se pudo acceder a la cámara. Revisa permisos.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsRecording(false);
    setElapsed(0);
    setStatus("Cámara apagada.");
  };

  const startRecording = () => {
    if (!streamRef.current) {
      setStatus("Primero enciende la cámara.");
      return;
    }

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm",
    });

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `aurevi-record-${Date.now()}.webm`, {
        type: "video/webm",
      });
      onVideoReady?.(file);
      setStatus("Grabación terminada. Lista para subir.");
      setElapsed(0);
    };

    mediaRecorder.start();
    setIsRecording(true);
    setStatus("Grabando...");
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Temporizador y límite de tiempo
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (maxDurationSec > 0 && next >= maxDurationSec) {
          stopRecording();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, maxDurationSec]);

  // Encender cámara al montar
  useEffect(() => {
    startCamera();
    return () => {
      stopRecording();
      stopCamera();
    };
  }, []);

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    const total =
      maxDurationSec > 0
        ? `${String(Math.floor(maxDurationSec / 60)).padStart(
            2,
            "0"
          )}:${String(maxDurationSec % 60).padStart(2, "0")}`
        : "∞";
    return `${m}:${s} / ${total}`;
  };

  const videoFilter =
    isMindful || isCuentoInfantil
      ? "saturate(1.05) contrast(0.95) brightness(1.02)"
      : undefined;

  return (
    <div className="aurevi-camera-shell">
      <div
        className="aurevi-camera-preview-wrapper"
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 18px 40px rgba(0,0,0,0.7)",
          border: "1px solid rgba(148,163,184,0.5)",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aurevi-video-player aurevi-camera-preview"
          style={{
            width: "100%",
            display: "block",
            filter: videoFilter,
            background: "#000",
          }}
        />
        {overlayStyle && <div style={overlayStyle} />}

        {themeMode !== "normal" && modeLabel && (
          <div
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              background: "rgba(15,23,42,0.8)",
              color: "#e5e7eb",
              border: "1px solid rgba(148,163,184,0.6)",
              backdropFilter: "blur(8px)",
            }}
          >
            {modeLabel}
          </div>
        )}
      </div>

      {themeMode !== "normal" && modeHint && (
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#9ca3af",
            lineHeight: 1.4,
          }}
        >
          {modeHint}
        </p>
      )}

      <div className="aurevi-camera-footer">
        <div className="aurevi-camera-controls-row">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={
              "aurevi-camera-btn-record" + (isRecording ? " is-recording" : "")
            }
          >
            {isRecording ? "Detener grabación" : "Empezar a grabar"}
          </button>

          <button
            type="button"
            onClick={stopCamera}
            className="aurevi-camera-btn-secondary"
          >
            Apagar cámara
          </button>

          <button
            type="button"
            onClick={startCamera}
            className="aurevi-camera-btn-secondary"
          >
            Encender cámara
          </button>
        </div>

        <div className="aurevi-camera-status-row">
          <span className="aurevi-camera-status-text">{status}</span>
          <span className="aurevi-camera-timer">{formatTime(elapsed)}</span>
        </div>
      </div>
    </div>
  );
}

export default CameraRecorder;