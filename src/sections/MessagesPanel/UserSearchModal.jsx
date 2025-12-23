// src/sections/MessagesPanel/UserSearchModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient"; // ✅ desde /sections/MessagesPanel sube 2 => src

export default function UserSearchModal({
  open = false,
  onClose = () => {},
  onPickUser = (user) => {}, // user = { id, username, avatar_url, ... }
  currentUserId = null,
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setResults([]);
    setErr("");
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const cleaned = useMemo(() => (q || "").trim(), [q]);
  
  useEffect(() => {
  console.log("UserSearchModal open =", open);
  if (!open) return;

  // aquí puedes ver si realmente se abre
}, [open]);

  useEffect(() => {
    if (!open) return;

    const run = async () => {
      const term = cleaned;
      if (!term || term.length < 2) {
        setResults([]);
        setErr("");
        return;
      }

      try {
        setLoading(true);
        setErr("");

        // ✅ Busca por username o display_name (si existe)
        // Ajusta campos según tu tabla profiles
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, full_name, avatar_url, email")
          .or(
            `username.ilike.%${term}%,display_name.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%`
          )
          .limit(12);

        if (error) throw error;

        // filtrar tu propio usuario
        const filtered = (data || []).filter((u) => u.id !== currentUserId);
        setResults(filtered);
      } catch (e) {
        console.error(e);
        setErr(e?.message || "No se pudo buscar usuarios.");
      } finally {
        setLoading(false);
      }
    };

    // debounce suave
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [open, cleaned, currentUserId]);

  if (!open) return null;

  const getName = (u) =>
    u?.display_name ||
    u?.full_name ||
    u?.username ||
    u?.email ||
    "Creador";

  const getSub = (u) => u?.username ? `@${u.username}` : (u?.email || "");

  const pick = (u) => {
    onPickUser(u);
    onClose();
  };

  return (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 999999, // 👈 AQUÍ
      background: "rgba(0,0,0,0.55)",
      display: "grid",
      placeItems: "center",
      padding: 16,
    }}
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
      <div
        style={{
          width: "min(560px, 96vw)",
          background: "rgba(10, 16, 32, 0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 14px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, color: "white" }}>
              Nuevo mensaje
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              Busca por usuario, nombre o email
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              fontWeight: 900,
              padding: "8px 10px",
              borderRadius: 12,
              cursor: "pointer",
            }}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: 12 }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escribe al menos 2 letras…"
            style={{
              width: "100%",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              padding: "11px 12px",
              outline: "none",
              fontSize: 14,
            }}
          />

          <div style={{ marginTop: 10, minHeight: 18 }}>
            {loading ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                Buscando…
              </div>
            ) : err ? (
              <div style={{ fontSize: 12, color: "#fca5a5" }}>{err}</div>
            ) : cleaned.length > 0 && cleaned.length < 2 ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                Escribe 2 letras o más para buscar.
              </div>
            ) : null}
          </div>
        </div>

        {/* Results */}
        <div style={{ padding: 12, paddingTop: 0, maxHeight: "52vh", overflowY: "auto" }}>
          {results.length === 0 && cleaned.length >= 2 && !loading && !err ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px dashed rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 13,
              }}
            >
              No encontré resultados para <b>{cleaned}</b>.
            </div>
          ) : (
            results.map((u) => {
              const name = getName(u);
              const sub = getSub(u);
              const avatar = u?.avatar_url || null;
              const letter = (name || "C").trim().charAt(0).toUpperCase();

              return (
                <button
                  key={u.id}
                  onClick={() => pick(u)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    marginBottom: 8,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  title={`Iniciar chat con ${name}`}
                >
                  {/* avatar */}
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        objectFit: "cover",
                        border: "1px solid rgba(255,255,255,0.14)",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                        color: "white",
                        background:
                          "linear-gradient(135deg, rgba(255,120,200,0.55), rgba(120,160,255,0.55))",
                        border: "1px solid rgba(255,255,255,0.14)",
                        flexShrink: 0,
                      }}
                    >
                      {letter}
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "white",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {name}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.65)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {sub}
                    </div>
                  </div>

                  <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                    Abrir →
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            Tip: busca por <b>@username</b> o email
          </div>

          <button
            onClick={onClose}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              fontWeight: 900,
              padding: "8px 10px",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
