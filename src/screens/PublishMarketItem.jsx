// src/screens/PublishMarketItem.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { WORLD_LABELS } from "../worlds/worldTypes"; // 👈 SOLO WORLD_LABELS

// 👇 Obtenemos las llaves a partir de WORLD_LABELS, sin depender de WORLD_KEYS exportado
const WORLD_KEYS = Object.keys(WORLD_LABELS);

function PublishMarketItem({ activeWorld = "publico", navigate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [world, setWorld] = useState(activeWorld || "publico");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg("");
    if (!name || !description) {
      setStatusMsg("Pon al menos un nombre y una descripción ✨");
      return;
    }

    setLoading(true);

    // price puede venir vacío -> lo mandamos como null
    const numericPrice =
      price === "" ? null : Number.isNaN(Number(price)) ? null : Number(price);

    const { error } = await supabase.from("market_items").insert([
      {
        name,
        description,
        price: numericPrice,
        world_type: world,
        thumbnail_url: thumbnailUrl || null,
        file_url: fileUrl || null,
      },
    ]);

    if (error) {
      console.error("Error publicando recurso:", error);
      setStatusMsg("No se pudo publicar el recurso. Revisa la consola.");
      setLoading(false);
      return;
    }

    setStatusMsg("✅ Recurso publicado en el mercado.");
    setLoading(false);

    // Opcional: limpiamos y volvemos al mercado
    setTimeout(() => {
      navigate("market");
    }, 800);
  };

  return (
    <section className="aurevi-screen">
      {/* Cabecera */}
      <div className="aurevi-home-top">
        <div>
          <h2 className="aurevi-screen-title">Publicar recurso</h2>
          <p className="aurevi-screen-description">
            Sube un recurso al mercado creativo de AUREVI.
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginTop: 4,
            }}
          >
            Mundo activo:{" "}
            <strong>{WORLD_LABELS[activeWorld] || "Mundo público"}</strong>
          </p>
        </div>

        <button
          type="button"
          className="aurevi-secondary-btn"
          style={{
            borderRadius: 999,
            padding: "6px 14px",
            border: "1px solid rgba(148,163,184,0.6)",
            background: "rgba(15,23,42,0.9)",
            color: "#e5e7eb",
            fontSize: 13,
          }}
          onClick={() => navigate("market")}
        >
          ← Volver al mercado
        </button>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: 20,
          maxWidth: 640,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Nombre */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
            }}
          >
            Nombre del recurso
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Pack de sonidos relajantes"
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.7)",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              padding: "8px 10px",
              fontSize: 14,
            }}
          />
        </div>

        {/* Descripción */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
            }}
          >
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Cuenta brevemente qué incluye el recurso."
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.7)",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              padding: "8px 10px",
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Mundo + precio */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 180px" }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#e5e7eb",
                marginBottom: 4,
              }}
            >
              Mundo
            </label>
            <select
              value={world}
              onChange={(e) => setWorld(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.95)",
                color: "#e5e7eb",
                padding: "8px 10px",
                fontSize: 14,
              }}
            >
              {WORLD_KEYS.map((key) => (
                <option key={key} value={key}>
                  {WORLD_LABELS[key] || key}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 140 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#e5e7eb",
                marginBottom: 4,
              }}
            >
              Precio (USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="5.00"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.95)",
                color: "#e5e7eb",
                padding: "8px 10px",
                fontSize: 14,
              }}
            />
          </div>
        </div>

        {/* Thumbnail */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
            }}
          >
            URL de imagen (thumbnail)
          </label>
          <input
            type="text"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://images.pexels.com/..."
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.7)",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              padding: "8px 10px",
              fontSize: 14,
            }}
          />
        </div>

        {/* URL de archivo */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
            }}
          >
            URL del archivo (ZIP, MP3, etc.)
          </label>
          <input
            type="text"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://.../market-files/recurso-prueba.zip"
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.7)",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              padding: "8px 10px",
              fontSize: 14,
            }}
          />
          <p
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "#9ca3af",
            }}
          >
            Aquí pegas la URL pública del archivo que subiste a Supabase
            Storage (bucket <code>market-files</code>).
          </p>
        </div>

        {/* Estado */}
        {statusMsg && (
          <p
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#e5e7eb",
            }}
          >
            {statusMsg}
          </p>
        )}

        {/* Botón enviar */}
        <button
          type="submit"
          className="aurevi-primary-btn"
          disabled={loading}
          style={{
            marginTop: 10,
            alignSelf: "flex-start",
            padding: "8px 18px",
            borderRadius: 999,
            background: loading
              ? "rgba(148,163,184,0.5)"
              : "linear-gradient(90deg,#4f46e5,#ec4899,#f97316)",
            fontSize: 14,
          }}
        >
          {loading ? "Publicando..." : "Publicar recurso"}
        </button>
      </form>
    </section>
  );
}

export default PublishMarketItem;