// src/screens/MyLibrary.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { WORLD_LABELS } from "../worlds/worldTypes";

function MyLibrary({ activeWorld, navigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const worldLabel = WORLD_LABELS[activeWorld] || "Mundo público";

  useEffect(() => {
    const loadLibrary = async () => {
      setLoading(true);
      setErrorMsg("");

      const { data: userData, error: userError } = await supabase
        .auth
        .getUser();

      if (userError || !userData?.user) {
        console.error(userError);
        setErrorMsg("No pudimos obtener tu usuario actual.");
        setLoading(false);
        return;
      }

      const user = userData.user;

      const { data, error } = await supabase
        .from("user_library")
        .select(`
          id,
          created_at,
          market_items:market_items (
            id,
            name,
            description,
            short_description,
            thumbnail_url,
            file_url,
            price_usd,
            world_scope,
            type
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error cargando biblioteca:", error);
        setErrorMsg("No se pudo cargar tu biblioteca creativa.");
        setLoading(false);
        return;
      }

      setItems(data || []);
      setLoading(false);
    };

    loadLibrary();
  }, []);

  const handleDownload = (marketItem) => {
    if (!marketItem?.file_url) {
      alert("Este recurso todavía no tiene un archivo de descarga configurado.");
      return;
    }
    // Abre la URL del recurso en una nueva pestaña
    window.open(marketItem.file_url, "_blank");
  };

  const handleOpenDetail = (marketItem) => {
    navigate("marketDetail", { item: marketItem });
  };

  return (
    <section className="aurevi-screen">
      {/* Cabecera */}
      <div className="aurevi-home-top">
        <h2 className="aurevi-screen-title">Mi biblioteca creativa</h2>
        <p className="aurevi-screen-description">
          Aquí verás los recursos que has obtenido del mercado creativo de AUREVI.
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

      {loading && (
        <p className="aurevi-home-status">Cargando tu biblioteca...</p>
      )}

      {errorMsg && !loading && (
        <p className="aurevi-home-status aurevi-home-status-error">
          {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && items.length === 0 && (
        <p className="aurevi-home-status">
          Todavía no has agregado recursos a tu biblioteca.  
          Ve al Mercado creativo y obtén tu primer recurso ✨
        </p>
      )}

      <div className="aurevi-market-grid">
        {items.map((row) => {
          const item = row.market_items;
          if (!item) return null;

          const itemWorldLabel =
            WORLD_LABELS[item.world_scope] ||
            item.world_scope ||
            worldLabel;

          return (
            <article
              key={row.id}
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

              {/* Info + acciones */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "#9ca3af",
                  }}
                >
                  Mi recurso · {itemWorldLabel}
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
                    "Recurso creativo de tu biblioteca."}
                </p>

                {/* Botones */}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    className="aurevi-primary-btn"
                    style={{
                      padding: "8px 16px",
                      borderRadius: 999,
                      background:
                        "linear-gradient(90deg,#22c55e,#0ea5e9,#6366f1)",
                      fontSize: 13,
                    }}
                    onClick={() => handleDownload(item)}
                  >
                    Descargar recurso
                  </button>

                  <button
                    type="button"
                    className="aurevi-secondary-btn"
                    style={{
                      padding: "8px 16px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.6)",
                      background: "rgba(15,23,42,0.9)",
                      color: "#e5e7eb",
                      fontSize: 13,
                    }}
                    onClick={() => handleOpenDetail(item)}
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default MyLibrary;