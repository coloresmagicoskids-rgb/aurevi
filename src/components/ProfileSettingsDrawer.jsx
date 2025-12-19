// src/components/ProfileSettingsDrawer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const SESSION_STORAGE_KEY = "aurevi_session_id";

function getOrCreateSessionId() {
  let sid = null;
  try {
    sid = localStorage.getItem(SESSION_STORAGE_KEY);
  } catch (_) {}

  if (!sid) {
    sid = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, sid);
    } catch (_) {}
  }
  return sid;
}

function isOnline(lastSeenAtIso, thresholdMs = 90_000) {
  if (!lastSeenAtIso) return false;
  const t = new Date(lastSeenAtIso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= thresholdMs;
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function ProfileSettingsDrawer({ open, onClose, onNavigate, user }) {
  const [openKey, setOpenKey] = useState("privacy"); // sección abierta por defecto
  const [activeItem, setActiveItem] = useState(null); // { key, label, icon, sectionKey }

  // Sesiones/dispositivos (punto 2.2)
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsErr, setSessionsErr] = useState("");
  const heartbeatRef = useRef(null);

  const sections = useMemo(
    () => [
      {
        key: "help",
        icon: "❓",
        title: "Ayuda y soporte técnico",
        items: [
          { key: "help_center", icon: "📘", label: "Centro de ayuda" },
          { key: "report", icon: "🛠️", label: "Reportar un problema" },
          { key: "status", icon: "🟢", label: "Estado del sistema" },
        ],
      },
      {
        key: "privacy",
        icon: "⚙️",
        title: "Configuración y privacidad",
        items: [
          { key: "settings", icon: "⚙️", label: "Configuración" },
          { key: "privacy_center", icon: "🔒", label: "Centro de privacidad" },
          { key: "devices", icon: "💻", label: "Solicitudes de dispositivos" },
          { key: "ads", icon: "📣", label: "Actividad publicitaria reciente" },
          { key: "payments", icon: "💳", label: "Pedidos y pagos" },
          { key: "links", icon: "🔗", label: "Historial de enlaces" },
        ],
      },
    ],
    []
  );

  // Si el drawer se cierra, limpiamos el subpanel para que al abrir vuelva al menú
  const handleClose = () => {
    setActiveItem(null);
    onClose?.();
  };

  // ─────────────────────────────────────────────
  // 2.2: registrar “esta sesión” + heartbeat + cargar sesiones
  // Solo cuando el subpanel "devices" está abierto.
  // ─────────────────────────────────────────────
  const ensureAndHeartbeatSession = async () => {
    if (!user?.id) return;

    const sessionId = getOrCreateSessionId();

    // Info simple (mejorable luego)
    const deviceName = "Web";
    const platform = navigator?.platform || "unknown";
    const appVersion = "AUREVI-web";

    // Upsert: crea o actualiza la sesión
    const payload = {
      user_id: user.id,
      session_id: sessionId,
      device_name: deviceName,
      platform,
      app_version: appVersion,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    };

    const { error } = await supabase
      .from("user_sessions")
      .upsert(payload, { onConflict: "user_id,session_id" });

    if (error) {
      console.error("ensureSession upsert error:", error);
      throw error;
    }
  };

  const loadSessions = async () => {
    if (!user?.id) return;
    setSessionsErr("");
    setSessionsLoading(true);

    try {
      // Asegura que exista y actualiza esta sesión
      await ensureAndHeartbeatSession();

      const { data, error } = await supabase
        .from("user_sessions")
        .select(
          "id, user_id, session_id, device_name, platform, app_version, ip, last_seen_at, created_at, revoked_at"
        )
        .eq("user_id", user.id)
        .order("last_seen_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (e) {
      setSessionsErr(e?.message || "No se pudieron cargar las sesiones.");
    }

    setSessionsLoading(false);
  };

  // Arranca/para heartbeat SOLO cuando estás en "devices" y drawer abierto
  useEffect(() => {
    const inDevicesPanel = open && activeItem?.key === "devices";

    if (!inDevicesPanel) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    // carga inicial
    loadSessions();

    // heartbeat cada 30s + recarga lista para ver “en línea”
    heartbeatRef.current = setInterval(async () => {
      try {
        await ensureAndHeartbeatSession();
        await loadSessions();
      } catch (e) {
        // no spamear errores; solo log
        console.warn("heartbeat error:", e?.message);
      }
    }, 30_000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeItem?.key, user?.id]);

  const closeOtherSessions = async () => {
    if (!user?.id) return;
    const sessionId = getOrCreateSessionId();

    setSessionsErr("");
    setSessionsLoading(true);
    try {
      const { error } = await supabase
        .from("user_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .neq("session_id", sessionId)
        .is("revoked_at", null);

      if (error) throw error;
      await loadSessions();
    } catch (e) {
      setSessionsErr(e?.message || "No se pudieron cerrar las otras sesiones.");
    }
    setSessionsLoading(false);
  };

  const closeOneSession = async (targetSessionId) => {
    if (!user?.id) return;

    setSessionsErr("");
    setSessionsLoading(true);
    try {
      const { error } = await supabase
        .from("user_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("session_id", targetSessionId);

      if (error) throw error;
      await loadSessions();
    } catch (e) {
      setSessionsErr(e?.message || "No se pudo cerrar esa sesión.");
    }
    setSessionsLoading(false);
  };

  if (!open) return null;

  // Render de contenido del subpanel
  const renderSubpanel = () => {
    if (!activeItem) return null;

    const panelStyle = {
      borderRadius: 14,
      border: "1px solid rgba(148,163,184,0.22)",
      background: "rgba(15,23,42,0.7)",
      overflow: "hidden",
    };

    const headerStyle = {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 12px",
      borderBottom: "1px solid rgba(148,163,184,0.18)",
      background: "rgba(2,6,23,0.25)",
      color: "#e5e7eb",
    };

    const bodyStyle = { padding: 12, color: "#e5e7eb", fontSize: 13 };

    const BackBtn = () => (
      <button
        type="button"
        onClick={() => setActiveItem(null)}
        style={{
          border: "none",
          background: "rgba(148,163,184,0.15)",
          color: "#e5e7eb",
          borderRadius: 12,
          padding: "8px 10px",
          cursor: "pointer",
        }}
        title="Atrás"
      >
        ←
      </button>
    );

    const Title = () => (
      <div style={{ fontWeight: 800, fontSize: 14 }}>
        {activeItem.icon} {activeItem.label}
      </div>
    );

    switch (activeItem.key) {
      case "settings":
        return (
          <div style={panelStyle}>
            <div style={headerStyle}>
              <BackBtn />
              <Title />
            </div>
            <div style={bodyStyle}>
              <p style={{ marginTop: 0, color: "#cbd5e1" }}>
                Aquí irán tus opciones generales de AUREVI (cuenta, notificaciones,
                idioma, etc.).
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                <Row label="Notificaciones" hint="Próximamente" />
                <Row label="Idioma" hint="Próximamente" />
                <Row label="Preferencias" hint="Próximamente" />
              </div>
            </div>
          </div>
        );

      case "privacy_center":
        return (
          <div style={panelStyle}>
            <div style={headerStyle}>
              <BackBtn />
              <Title />
            </div>
            <div style={bodyStyle}>
              <p style={{ marginTop: 0, color: "#cbd5e1" }}>
                Controles de privacidad: visibilidad, bloqueos, datos, etc.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                <Row label="Quién puede ver mi perfil" hint="Próximamente" />
                <Row label="Bloqueos" hint="Próximamente" />
                <Row label="Descargar mis datos" hint="Próximamente" />
              </div>
            </div>
          </div>
        );

      // ✅ 2.2 REAL: sesiones/dispositivos
      case "devices": {
        const mySid = getOrCreateSessionId();

        return (
          <div style={panelStyle}>
            <div style={headerStyle}>
              <BackBtn />
              <Title />

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={loadSessions}
                  style={{
                    border: "none",
                    background: "rgba(148,163,184,0.15)",
                    color: "#e5e7eb",
                    borderRadius: 12,
                    padding: "8px 10px",
                    cursor: "pointer",
                  }}
                  title="Actualizar"
                >
                  ↻
                </button>
              </div>
            </div>

            <div style={bodyStyle}>
              <p style={{ marginTop: 0, color: "#cbd5e1" }}>
                Aquí verás tus sesiones/dispositivos. Marcamos <strong>“Esta sesión”</strong>{" "}
                y detectamos <strong>“en línea”</strong> usando <code>last_seen_at</code>.
              </p>

              {!user?.id && (
                <div style={{ color: "#fca5a5" }}>
                  No hay usuario activo para cargar sesiones.
                </div>
              )}

              {sessionsErr && (
                <div style={{ color: "#fca5a5", marginBottom: 10 }}>
                  {sessionsErr}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={closeOtherSessions}
                  disabled={sessionsLoading || !user?.id}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(2,6,23,0.35)",
                    color: "#e5e7eb",
                    borderRadius: 12,
                    padding: "10px 10px",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  Cerrar otras sesiones
                </button>

                <div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 12 }}>
                  {sessionsLoading ? "Cargando…" : `${sessions.length} sesiones`}
                </div>
              </div>

              {sessions.length === 0 && !sessionsLoading ? (
                <div style={{ color: "#cbd5e1" }}>
                  No hay sesiones registradas todavía.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {sessions.map((s) => {
                    const mine = String(s.session_id) === String(mySid);
                    const online = !s.revoked_at && isOnline(s.last_seen_at);

                    return (
                      <div
                        key={s.id}
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.18)",
                          background: "rgba(2,6,23,0.35)",
                          padding: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontWeight: 900 }}>
                            {mine ? "🟣 Esta sesión" : "🖥️ Sesión"}
                          </div>

                          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>
                            {s.revoked_at ? (
                              <span style={{ color: "#fca5a5" }}>Cerrada</span>
                            ) : online ? (
                              <span style={{ color: "#86efac" }}>En línea</span>
                            ) : (
                              <span style={{ color: "#cbd5e1" }}>Inactiva</span>
                            )}
                          </div>
                        </div>

                        <div style={{ height: 8 }} />

                        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>
                          <div>
                            <strong>Dispositivo:</strong> {s.device_name || "—"}
                          </div>
                          <div>
                            <strong>Plataforma:</strong> {s.platform || "—"}{" "}
                            <span style={{ opacity: 0.7 }}>
                              ({s.app_version || "—"})
                            </span>
                          </div>
                          <div>
                            <strong>Última actividad:</strong> {fmtTime(s.last_seen_at)}
                          </div>
                          <div style={{ opacity: 0.7 }}>
                            <strong>Creada:</strong> {fmtTime(s.created_at)}
                          </div>
                        </div>

                        <div style={{ height: 10 }} />

                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => closeOneSession(s.session_id)}
                            disabled={sessionsLoading || mine || !!s.revoked_at}
                            style={{
                              border: "1px solid rgba(248,113,113,0.35)",
                              background: mine
                                ? "rgba(148,163,184,0.10)"
                                : "rgba(248,113,113,0.12)",
                              color: "#e5e7eb",
                              borderRadius: 12,
                              padding: "8px 10px",
                              cursor: mine ? "not-allowed" : "pointer",
                              fontWeight: 900,
                              fontSize: 12,
                              opacity: mine ? 0.6 : 1,
                            }}
                            title={mine ? "No puedes cerrar esta misma sesión aquí." : "Cerrar sesión"}
                          >
                            Cerrar
                          </button>

                          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                            {mine ? "session_id actual" : `session_id: ${String(s.session_id).slice(0, 8)}…`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
                Próximo (2.3): si una sesión es revocada, forzamos logout automático en ese dispositivo.
              </div>
            </div>
          </div>
        );
      }

      default:
        return (
          <div style={panelStyle}>
            <div style={headerStyle}>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                style={{
                  border: "none",
                  background: "rgba(148,163,184,0.15)",
                  color: "#e5e7eb",
                  borderRadius: 12,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
                title="Atrás"
              >
                ←
              </button>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {activeItem.icon} {activeItem.label}
              </div>
            </div>

            <div style={bodyStyle}>
              <p style={{ marginTop: 0, color: "#cbd5e1" }}>
                Subpanel listo. Aquí pondremos el contenido real de{" "}
                <strong>{activeItem.key}</strong>.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                <Row label="Opción A" hint="Próximamente" />
                <Row label="Opción B" hint="Próximamente" />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          width: "min(420px, 92vw)",
          height: "100%",
          background: "rgba(10,14,25,0.98)",
          borderLeft: "1px solid rgba(148,163,184,0.25)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.45)",
          padding: 14,
          overflow: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#e5e7eb" }}>
            {activeItem ? "Configuración" : "Ajustes"}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                border: "none",
                background: "rgba(148,163,184,0.15)",
                color: "#e5e7eb",
                borderRadius: 12,
                padding: "8px 10px",
                cursor: "pointer",
              }}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {/* Si hay item activo => Subpanel. Si no => Menú */}
        {activeItem ? (
          renderSubpanel()
        ) : (
          <>
            {sections.map((sec) => {
              const isOpen = openKey === sec.key;
              return (
                <div
                  key={sec.key}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,0.22)",
                    background: "rgba(15,23,42,0.7)",
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? "" : sec.key)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#e5e7eb",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    <span style={{ width: 26, textAlign: "center" }}>
                      {sec.icon}
                    </span>
                    <span style={{ flex: 1, textAlign: "left" }}>{sec.title}</span>
                    <span style={{ opacity: 0.9 }}>{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: "8px 8px 10px" }}>
                      {sec.items.map((it) => (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => {
                            setActiveItem({ ...it, sectionKey: sec.key });
                            onNavigate?.(it.key);
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(148,163,184,0.18)",
                            background: "rgba(2,6,23,0.35)",
                            color: "#e5e7eb",
                            cursor: "pointer",
                            marginBottom: 8,
                            textAlign: "left",
                          }}
                        >
                          <span style={{ width: 26, textAlign: "center" }}>
                            {it.icon}
                          </span>
                          <span style={{ flex: 1 }}>{it.label}</span>
                          <span style={{ opacity: 0.65 }}>›</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ height: 10 }} />
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Tip: cada item abre su subpanel dentro del mismo drawer (estilo Facebook).
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Pequeño componente visual reutilizable (no necesita archivo aparte)
function Row({ label, hint }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 10px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,0.18)",
        background: "rgba(2,6,23,0.35)",
      }}
    >
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ opacity: 0.75, fontSize: 12, color: "#cbd5e1" }}>{hint}</div>
    </div>
  );
}