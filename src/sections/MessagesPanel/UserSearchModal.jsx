// src/sections/MessagesPanel/UserSearchModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function UserSearchModal({
  open = false,
  onClose = () => {},
  onPickUser = () => {},
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

  // Normaliza: "@carlos" => "carlos"
  const term = useMemo(() => {
    let t = (q || "").trim();
    if (t.startsWith("@")) t = t.slice(1);
    return t;
  }, [q]);

  const looksLikeEmail = useMemo(() => {
    const t = (q || "").trim();
    // heurística simple: contiene @ y punto luego
    return t.includes("@") && t.includes(".");
  }, [q]);

  useEffect(() => {
    if (!open) return;

    const run = async () => {
      // Si parece email, no buscamos (estilo red social)
      if (looksLikeEmail) {
        setResults([]);
        setErr("En AUREVI se busca por @username (no por email).");
        return;
      }

      if (!term || term.length < 2) {
        setResults([]);
        setErr("");
        return;
      }

      try {
        setLoading(true);
        setErr("");

        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .ilike("username", `%${term}%`)
          .limit(12);

        if (error) throw error;

        setResults((data || []).filter((u) => u.id !== currentUserId));
      } catch (e) {
        console.error(e);
        setErr(e?.message || "No se pudo buscar usuarios.");
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [open, term, looksLikeEmail, currentUserId]);

  if (!open) return null;

  const pick = (u) => {
    onPickUser(u);
    onClose();
  };

  const usernameLabel = (u) => (u?.username ? `@${u.username}` : "Usuario");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
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
            <div style={{ fontWeight: 900, color: "white" }}>Nuevo mensaje</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              Busca por username (ej: @carlos)
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
            placeholder="Escribe @username…"
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
            ) : term.length > 0 && term.length < 2 ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                Escribe 2 letras o más para buscar.
              </div>
            ) : null}
          </div>
        </div>

        {/* Results */}
        <div
          style={{
            padding: 12,
            paddingTop: 0,
            maxHeight: "52vh",
            overflowY: "auto",
          }}
        >
          {results.length === 0 && term.length >= 2 && !loading && !err ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px dashed rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 13,
              }}
            >
              No encontré resultados para <b>@{term}</b>.
            </div>
          ) : (
            results.map((u) => {
              const avatar = u?.avatar_url || null;
              const label = usernameLabel(u);
              const letter = (label || "U").replace("@", "").charAt(0).toUpperCase();

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
                  title={`Iniciar chat con ${label}`}
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={label}
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
                      {label}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                      Usuario
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
            Tip: escribe <b>@usuario</b>
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