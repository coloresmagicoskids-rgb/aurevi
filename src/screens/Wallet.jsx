// src/screens/Wallet.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { WORLD_LABELS } from "../worlds/WorldTypes";

function Wallet({ activeWorld, navigate }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const worldLabel = WORLD_LABELS[activeWorld] || "Mundo público";

  // Cargar billetera + transacciones
  const loadWalletAndTx = async () => {
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setErrorMsg("Necesitas iniciar sesión para ver tu billetera.");
        setLoading(false);
        return;
      }

      const user = userData.user;

      // 1) Buscar billetera
      let { data: walletRow, error: walletError } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Si no existe, la creamos con balance 0
      if (!walletRow && !walletError) {
        const { data: inserted, error: insertError } = await supabase
          .from("user_wallets")
          .insert({ user_id: user.id, balance: 0 })
          .select("*")
          .maybeSingle();

        if (insertError) {
          console.error("Error creando billetera:", insertError);
          setErrorMsg("No se pudo crear tu billetera en AUREVI.");
          setLoading(false);
          return;
        }

        walletRow = inserted;
      } else if (walletError) {
        console.error("Error leyendo billetera:", walletError);
        setErrorMsg("No se pudo cargar tu billetera.");
        setLoading(false);
        return;
      }

      setWallet(walletRow);

      // 2) Cargar últimas transacciones
      const { data: txRows, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (txError) {
        console.error("Error cargando transacciones:", txError);
        setTransactions([]);
      } else {
        setTransactions(txRows || []);
      }
    } catch (err) {
      console.error("Error inesperado en Wallet:", err);
      setErrorMsg("Ocurrió un error al cargar tu billetera.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletAndTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarga de prueba: +10 monedas
  const handleTestTopUp = async () => {
    setActionLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setErrorMsg("No se pudo detectar tu usuario.");
        setActionLoading(false);
        return;
      }

      const user = userData.user;

      const { error } = await supabase.rpc("credit_wallet", {
        p_user: user.id,
        p_amount: 10,
        p_meta: { reason: "test_topup", source: "wallet_test_button" },
      });

      if (error) {
        console.error("Error llamando credit_wallet:", error);
        setErrorMsg("No se pudo recargar tus monedas de prueba.");
      } else {
        setInfoMsg("Se añadieron 10 monedas de prueba a tu billetera 🎉");
        await loadWalletAndTx();
      }
    } catch (err) {
      console.error("Error inesperado en recarga:", err);
      setErrorMsg("Ocurrió un error al recargar tus monedas.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatAmount = (n) => {
    if (n == null) return "0";
    return Number(n).toLocaleString("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section className="aurevi-screen">
      {/* Cabecera */}
      <div className="aurevi-home-top">
        <h2 className="aurevi-screen-title">Billetera creativa</h2>
        <p className="aurevi-screen-description">
          Aquí ves y gestionas tus monedas internas de AUREVI para el Pentaverso.
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

      {/* Tarjeta de saldo principal */}
      <div
        className="aurevi-feed-card"
        style={{
          marginTop: 12,
          padding: 18,
          borderRadius: 18,
          background:
            "radial-gradient(circle at top,#1f2937,#020617 55%,#000000)",
          border: "1px solid rgba(148,163,184,0.5)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "#9ca3af",
            marginBottom: 8,
          }}
        >
          Saldo disponible
        </div>

        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Cargando billetera...</p>
        ) : wallet ? (
          <>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: "#f9fafb",
              }}
            >
              {formatAmount(wallet.balance)}{" "}
              <span
                style={{
                  fontSize: 16,
                  opacity: 0.85,
                }}
              >
                monedas AUREVI
              </span>
            </div>
            <p
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              Usa estas monedas para desbloquear recursos del Marketplace y
              potenciar tus creaciones.
            </p>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="aurevi-primary-btn"
                disabled={actionLoading}
                onClick={handleTestTopUp}
                style={{
                  borderRadius: 999,
                  padding: "8px 16px",
                  background:
                    "linear-gradient(90deg,#22c55e,#a3e635,#facc15)",
                  fontSize: 13,
                }}
              >
                {actionLoading
                  ? "Añadiendo monedas..."
                  : "+10 monedas de prueba"}
              </button>

              <button
                type="button"
                className="aurevi-secondary-btn"
                onClick={loadWalletAndTx}
                style={{
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontSize: 13,
                  background: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(148,163,184,0.7)",
                  color: "#e5e7eb",
                }}
              >
                Actualizar saldo
              </button>

              <button
                type="button"
                className="aurevi-secondary-btn"
                onClick={() => navigate("market")}
                style={{
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontSize: 13,
                  background: "rgba(30,64,175,0.85)",
                  border: "1px solid rgba(59,130,246,0.8)",
                  color: "#e5e7eb",
                }}
              >
                Ir al Marketplace
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "#fca5a5", fontSize: 14 }}>
            No se encontró tu billetera.
          </p>
        )}

        {errorMsg && (
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "#fca5a5",
            }}
          >
            {errorMsg}
          </p>
        )}
        {infoMsg && (
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "#bbf7d0",
            }}
          >
            {infoMsg}
          </p>
        )}
      </div>

      {/* Historial de transacciones */}
      <div
        className="aurevi-feed-card"
        style={{ marginTop: 16, padding: 16, borderRadius: 16 }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            marginBottom: 8,
          }}
        >
          Historial de movimientos
        </h3>

        {loading ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Leyendo movimientos...
          </p>
        ) : transactions.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Aún no tienes movimientos en tu billetera. Prueba añadir monedas de
            prueba.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {transactions.map((tx) => {
              const isCredit = tx.type === "credit";
              const sign = isCredit ? "+" : "-";
              const color = isCredit ? "#4ade80" : "#f97316";

              // texto desde meta -> description si existe
              const metaDesc =
                tx.meta?.description ||
                tx.meta?.reason ||
                (isCredit ? "Recarga de monedas" : "Compra en el mercado");

              return (
                <li
                  key={tx.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 8px",
                    borderRadius: 10,
                    background: "rgba(15,23,42,0.9)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#e5e7eb",
                      }}
                    >
                      {metaDesc}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9ca3af",
                      }}
                    >
                      {formatDate(tx.created_at)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color,
                    }}
                  >
                    {sign}
                    {formatAmount(tx.amount)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export default Wallet;