// src/screens/Marketplace.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { WORLD_LABELS } from "../worlds/worldTypes";

function Marketplace({ activeWorld, navigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const worldLabel = WORLD_LABELS[activeWorld] || "Mundo público";

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("market_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error cargando el marketplace:", error);
        setErrorMsg("No se pudieron cargar los recursos del mercado.");
        setLoading(false);
        return;
      }

      setItems(data || []);
      setLoading(false);
    };

    loadItems();
  }, []);

  return (
    <section className="aurevi-screen">
      {/* Cabecera con botón Publicar recurso */}
      <div
        className="aurevi-home-top"
        style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
      >
        <div>
          <h2 className="aurevi-screen-title">Mercado creativo</h2>
          <p className="aurevi-screen-description">
            Recursos, packs y herramientas para potenciar tus creaciones en
            AUREVI.
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginTop: 4,
            }}
          >
            Mundo activo: <strong>{worldLabel}</strong>
          </p>
        </div>

        <button
          type="button"
          className="aurevi-primary-btn"
          style={{
            alignSelf: "center",
            padding: "6px 16px",
            borderRadius: 999,
            background: "linear-gradient(90deg,#22c55e,#a3e635,#4ade80)",
            fontSize: 13,
          }}
          onClick={() => navigate("marketPublish")}
        >
          + Publicar recurso
        </button>
      </div>

      {loading && (
        <p className="aurevi-home-status">Cargando recursos del mercado...</p>
      )}

      {errorMsg && (
        <p className="aurevi-home-status aurevi-home-status-error">
          {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && items.length === 0 && (
        <p className="aurevi-home-status">
          Aún no hay recursos publicados en el mercado. Muy pronto verás packs,
          sonidos, plantillas y más.
        </p>
      )}

      <div className="aurevi-market-grid">
        {items.map((item) => {
          const world =
            item.world_type || item.world_scope || activeWorld || "publico";
          const worldText = WORLD_LABELS[world] || world;
          const price = item.price_usd ?? item.price ?? null;

          return (
            <article
              key={item.id}
              className="aurevi-market-card"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.2fr)",
                gap: 20,
                padding: 16,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.98))",
                border: "1px solid rgba(148,163,184,0.35)",
                overflow: "hidden",
              }}
            >
              {/* Vista previa */}
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  background:
                    "linear-gradient(135deg,#1d4ed8,#4f46e5,#ec4899,#facc15)",
                }}
              >
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      maxHeight: 260,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      minHeight: 260,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#e5e7eb",
                      fontSize: 14,
                      padding: 16,
                    }}
                  >
                    Vista previa del recurso
                  </div>
                )}
              </div>

              {/* Info + botón Ver detalle */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "#9ca3af",
                  }}
                >
                  Recurso del mercado · {worldText}
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#f9fafb",
                  }}
                >
                  {item.name}
                </h3>

                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 14,
                    color: "#e5e7eb",
                    lineHeight: 1.5,
                  }}
                >
                  {item.short_description ||
                    item.description ||
                    "Recurso creativo para tus proyectos en AUREVI."}
                </p>

                {/* Chips rápidos */}
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  {price != null && (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "rgba(22,163,74,0.18)",
                        color: "#bbf7d0",
                        border: "1px solid rgba(34,197,94,0.7)",
                      }}
                    >
                      ${price} USD
                    </span>
                  )}
                  {item.type && (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.9)",
                        color: "#e5e7eb",
                        border: "1px solid rgba(148,163,184,0.5)",
                      }}
                    >
                      {item.type}
                    </span>
                  )}
                </div>

                {/* Botón Ver detalle */}
                <button
                  type="button"
                  className="aurevi-primary-btn"
                  style={{
                    marginTop: 10,
                    alignSelf: "flex-start",
                    padding: "8px 16px",
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg,#4f46e5,#ec4899,#f97316)",
                    fontSize: 13,
                  }}
                  onClick={() => navigate("marketDetail", { item })}
                >
                  Ver detalle
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Marketplace;