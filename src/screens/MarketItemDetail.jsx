// src/screens/MarketItemDetail.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { WORLD_TYPES, WORLD_LABELS } from "../worlds/worldTypes";

function MarketItemDetail({ item, navigate, activeWorld }) {
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!item) {
    return (
      <section className="aurevi-screen">
        <h2 className="aurevi-screen-title">Recurso no encontrado</h2>
        <p className="aurevi-screen-description">
          No pudimos cargar la informaci車n de este recurso.
        </p>
        <button
          type="button"
          className="aurevi-primary-btn"
          onClick={() => navigate("market")}
        >
          Volver al mercado
        </button>
      </section>
    );
  }

  const worldLabel = WORLD_LABELS[activeWorld] || "Mundo p迆blico";

  // ?? Usamos price_usd como "precio en monedas AUREVI" por ahora
  const itemPrice = item.price_usd != null ? Number(item.price_usd) : 0;

  const handleGetResource = async () => {
    try {
      setProcessing(true);
      setErrorMsg("");
      setSuccessMsg("");

      // 1) Usuario actual
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Error obteniendo usuario:", userError);
        setErrorMsg("Debes iniciar sesi車n para obtener recursos.");
        setProcessing(false);
        return;
      }

      // 2) ?Ya est芍 en la biblioteca?
      const { data: existingRows, error: libraryCheckError } =
        await supabase
          .from("user_library")
          .select("id")
          .eq("user_id", user.id)
          .eq("item_id", item.id);

      if (libraryCheckError) {
        console.error("Error comprobando biblioteca:", libraryCheckError);
        setErrorMsg("No se pudo comprobar tu biblioteca.");
        setProcessing(false);
        return;
      }

      if (existingRows && existingRows.length > 0) {
        setSuccessMsg("Este recurso ya est芍 en tu biblioteca.");
        return;
      }

      // 3) Si el 赤tem cuesta > 0, comprobamos saldo en wallet_transactions
      if (itemPrice > 0) {
        const { data: txData, error: txError } = await supabase
          .from("wallet_transactions")
          .select("type, amount")
          .eq("user_id", user.id);

        if (txError) {
          console.error("Error leyendo billetera:", txError);
          setErrorMsg("No se pudo leer tu billetera para comprobar el saldo.");
          setProcessing(false);
          return;
        }

        const balance = (txData || []).reduce((sum, tx) => {
          const amt = Number(tx.amount) || 0;
          if (tx.type === "debit") return sum - amt;
          return sum + amt;
        }, 0);

        if (balance < itemPrice) {
          setErrorMsg(
            `No tienes monedas suficientes. Este recurso cuesta ${itemPrice} y tu saldo es ${balance}.`
          );
          setProcessing(false);
          return;
        }

        // 4) Crear transacci車n debit
        const { error: debitError } = await supabase
          .from("wallet_transactions")
          .insert({
            user_id: user.id,
            type: "debit",
            amount: itemPrice,
            description: `Compra en el mercado: ${item.name}`,
          });

        if (debitError) {
          console.error("Error creando transacci車n de d谷bito:", debitError);
          setErrorMsg("No se pudo registrar el pago en tu billetera.");
          setProcessing(false);
          return;
        }
      }

      // 5) Insertar en user_library
      const { error: libraryError } = await supabase
        .from("user_library")
        .insert({
          user_id: user.id,
          item_id: item.id,
        });

      if (libraryError) {
        console.error("Error guardando en user_library:", libraryError);
        setErrorMsg(
          "El pago se registr車, pero no pudimos a?adir el recurso a tu biblioteca."
        );
        setProcessing(false);
        return;
      }

      setSuccessMsg("Recurso agregado a tu biblioteca ??");
    } catch (err) {
      console.error("Error inesperado al obtener recurso:", err);
      setErrorMsg("Ocurri車 un error inesperado al procesar tu compra.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="aurevi-screen aurevi-market-detail-screen">
      {/* Cabecera */}
      <div className="aurevi-home-top">
        <h2 className="aurevi-screen-title">{item.name}</h2>
        <p className="aurevi-screen-description">
          Recurso del mercado creativo de AUREVI.
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

      {/* Mensajes de estado */}
      {errorMsg && (
        <p
          style={{
            color: "#fecaca",
            fontSize: 13,
            marginTop: 8,
          }}
        >
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p
          style={{
            color: "#bbf7d0",
            fontSize: 13,
            marginTop: 8,
          }}
        >
          {successMsg}{" "}
          <button
            type="button"
            onClick={() => navigate("library")}
            style={{
              marginLeft: 6,
              border: "none",
              background: "transparent",
              color: "#93c5fd",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Ver mi biblioteca ↙
          </button>
        </p>
      )}

      {/* Tarjeta grande de detalle */}
      <div
        className="aurevi-market-detail-card"
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1.1fr)",
          gap: 24,
          padding: 20,
          borderRadius: 18,
          background: "radial-gradient(circle at top,#020617,#020617 40%,#000)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        {/* Imagen */}
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
                maxHeight: 360,
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

        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#9ca3af",
            }}
          >
            Recurso del mercado ﹞ {worldLabel}
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 22,
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
            {item.description ||
              "Recurso creativo para tus proyectos en AUREVI."}
          </p>

          {/* Info r芍pida */}
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              fontSize: 13,
            }}
          >
            {itemPrice > 0 && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(22,163,74,0.15)",
                  color: "#bbf7d0",
                  border: "1px solid rgba(34,197,94,0.7)",
                }}
              >
                Precio: <strong>{itemPrice} monedas</strong>
              </span>
            )}
            {item.world_scope && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(30,64,175,0.25)",
                  color: "#bfdbfe",
                  border: "1px solid rgba(59,130,246,0.7)",
                }}
              >
                Mundo:{" "}
                <strong>
                  {WORLD_LABELS[item.world_scope] || item.world_scope}
                </strong>
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
                Tipo: <strong>{item.type}</strong>
              </span>
            )}
          </div>

          {/* 芍rea de acciones principales */}
          <div
            style={{
              marginTop: 18,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="aurevi-primary-btn"
              style={{
                minWidth: 160,
                background:
                  "linear-gradient(90deg,#f97316,#ec4899,#8b5cf6)",
              }}
              disabled={processing}
              onClick={handleGetResource}
            >
              {processing ? "Procesando..." : "Obtener recurso"}
            </button>

            <button
              type="button"
              className="aurevi-secondary-btn"
              style={{
                minWidth: 140,
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.6)",
                background: "rgba(15,23,42,0.9)",
                color: "#e5e7eb",
                padding: "8px 16px",
              }}
              onClick={() => navigate("market")}
            >
              ↘ Volver al mercado
            </button>
          </div>

          {/* Texto extra */}
          {item.long_description && (
            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                lineHeight: 1.55,
                color: "#e5e7eb",
                whiteSpace: "pre-line",
              }}
            >
              {item.long_description}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MarketItemDetail;