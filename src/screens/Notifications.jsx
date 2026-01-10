// src/screens/Notifications.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

function Notifications({ navigate }) {
  const HOME_SCREEN = "home";

  const [currentUser, setCurrentUser] = useState(null);
  const [openSection, setOpenSection] = useState(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [items, setItems] = useState([]); // notifications rows
  const [profilesById, setProfilesById] = useState({}); // actor_id -> profile

  // ✅ Historial para “Deshacer”
  const historyRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  const toggle = (key) => {
    setOpenSection((prev) => {
      if (prev === key) return null;

      historyRef.current.push(prev);
      setCanUndo(true);

      return key;
    });
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    setOpenSection(prev ?? null);
    setCanUndo(historyRef.current.length > 0);
  };

  // ----------------------------------------------------
  // ✅ Helpers: timeAgo
  // ----------------------------------------------------
  const timeAgo = (iso) => {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - t);

    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins} min`;

    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs} h`;

    const days = Math.floor(hrs / 24);
    if (days === 1) return "Ayer";
    return `Hace ${days} días`;
  };

  // ----------------------------------------------------
  // ✅ Cargar usuario
  // ----------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("auth.getUser error:", error);
        setErrorMsg("No se pudo obtener el usuario.");
        setLoading(false);
        return;
      }
      setCurrentUser(data?.user || null);
    })();
  }, []);

  // ----------------------------------------------------
  // ✅ Cargar notificaciones
  // ----------------------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!currentUser?.id) {
        setItems([]);
        setProfilesById({});
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, recipient_id, actor_id, type, video_id, comment_id, message, created_at, read_at"
        )
        .eq("recipient_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!mounted) return;

      if (error) {
        console.error("notifications load error:", error);
        setErrorMsg("Error cargando alertas.");
        setLoading(false);
        return;
      }

      const list = data || [];
      setItems(list);
      setLoading(false);

      // cargar perfiles de actores en batch
      const actorIds = Array.from(
        new Set(list.map((x) => x.actor_id).filter(Boolean))
      );

      if (actorIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, avatar_url, display_name, username")
          .in("id", actorIds);

        if (!mounted) return;

        if (pErr) {
          console.error("profiles load error:", pErr);
        } else {
          const map = {};
          (profs || []).forEach((p) => (map[p.id] = p));
          setProfilesById(map);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentUser]);

  // ----------------------------------------------------
  // ✅ Realtime: INSERT + UPDATE (read_at)
  // ----------------------------------------------------
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          const row = payload?.new;
          if (!row?.id) return;

          setItems((prev) => {
            if (prev.some((x) => x.id === row.id)) return prev;
            return [row, ...prev];
          });

          // cargar perfil del actor si falta
          if (row.actor_id && !profilesById[row.actor_id]) {
            const { data: p } = await supabase
              .from("profiles")
              .select("id, avatar_url, display_name, username")
              .eq("id", row.actor_id)
              .maybeSingle();

            if (p?.id) {
              setProfilesById((prev) => ({ ...prev, [p.id]: p }));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const row = payload?.new;
          if (!row?.id) return;

          setItems((prev) =>
            prev.map((x) => (x.id === row.id ? { ...x, ...row } : x))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ----------------------------------------------------
  // ✅ Agrupar por tipo
  // ----------------------------------------------------
  const groups = useMemo(() => {
    const likes = [];
    const comments = [];
    const followers = [];

    for (const n of items) {
      if (n.type === "like") likes.push(n);
      else if (n.type === "comment") comments.push(n);
      else if (n.type === "follow") followers.push(n);
    }

    return { likes, comments, followers };
  }, [items]);

  const unreadCounts = useMemo(() => {
    const countUnread = (arr) =>
      arr.reduce((acc, n) => acc + (n.read_at ? 0 : 1), 0);

    const likes = countUnread(groups.likes);
    const comments = countUnread(groups.comments);
    const followers = countUnread(groups.followers);
    const total = likes + comments + followers;

    return { likes, comments, followers, total };
  }, [groups]);

  // ----------------------------------------------------
  // ✅ Mark as read
  // ----------------------------------------------------
  const markOneAsRead = async (id) => {
    if (!currentUser?.id || !id) return;

    setItems((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x
      )
    );

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("recipient_id", currentUser.id);

    if (error) {
      console.error("markOneAsRead error:", error);
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, read_at: null } : x))
      );
    }
  };

  const markManyAsRead = async (ids) => {
    if (!currentUser?.id) return;
    const clean = (ids || []).filter(Boolean);
    if (!clean.length) return;

    const nowIso = new Date().toISOString();

    setItems((prev) =>
      prev.map((x) =>
        clean.includes(x.id) ? { ...x, read_at: x.read_at || nowIso } : x
      )
    );

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: nowIso })
      .in("id", clean)
      .eq("recipient_id", currentUser.id);

    if (error) {
      console.error("markManyAsRead error:", error);
      try {
        const { data } = await supabase
          .from("notifications")
          .select(
            "id, recipient_id, actor_id, type, video_id, comment_id, message, created_at, read_at"
          )
          .eq("recipient_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(100);
        setItems(data || []);
      } catch {}
    }
  };

  const markAllAsRead = async () => {
    const ids = items.filter((x) => !x.read_at).map((x) => x.id);
    await markManyAsRead(ids);
  };

  const markSectionAsRead = async (key) => {
    const arr = groups[key] || [];
    const ids = arr.filter((x) => !x.read_at).map((x) => x.id);
    await markManyAsRead(ids);
  };

  // ----------------------------------------------------
  // ✅ Click en alerta → marcar leída + navegar al video (tu navegación interna)
  // ----------------------------------------------------
  const goToVideo = async (notif) => {
    if (!notif) return;

    if (!notif.read_at) {
      await markOneAsRead(notif.id);
    }

    if (notif.video_id) {
      navigate?.(HOME_SCREEN, { videoId: notif.video_id, from: "alerts" });
      return;
    }

    // ✅ ajuste mínimo: mandar params null explícito
    navigate?.(HOME_SCREEN, null);
  };

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------
  return (
    <section className="aurevi-screen">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h2 className="aurevi-screen-title">Alertas</h2>
          <p className="aurevi-screen-description">
            Aquí verás la actividad reciente relacionada con tu contenido.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            style={{
              border: "1px solid rgba(148,163,184,0.25)",
              background: canUndo ? "rgba(2,6,23,0.55)" : "rgba(2,6,23,0.25)",
              color: "#e5e7eb",
              borderRadius: 999,
              padding: "8px 12px",
              cursor: canUndo ? "pointer" : "not-allowed",
              fontSize: 13,
              opacity: canUndo ? 1 : 0.55,
            }}
            title="Volver a la sección anterior"
          >
            ↩︎ Deshacer
          </button>

          <button
            type="button"
            onClick={markAllAsRead}
            disabled={!items.some((x) => !x.read_at)}
            style={{
              border: "none",
              background: items.some((x) => !x.read_at)
                ? "linear-gradient(90deg, #6366f1, #a855f7)"
                : "rgba(148,163,184,0.18)",
              color: "#fff",
              borderRadius: 999,
              padding: "8px 12px",
              cursor: items.some((x) => !x.read_at) ? "pointer" : "not-allowed",
              fontSize: 13,
              opacity: items.some((x) => !x.read_at) ? 1 : 0.6,
            }}
            title="Marcar todas como leídas"
          >
            🗑️ Marcar todo leído
            {unreadCounts.total > 0 ? (
              <span
                style={{
                  marginLeft: 8,
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 900,
                }}
              >
                {unreadCounts.total}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {!currentUser && (
        <div
          className="aurevi-feed-card"
          style={{ marginTop: 16, padding: 14, color: "#9ca3af" }}
        >
          Inicia sesión para ver tus alertas.
        </div>
      )}

      {currentUser && loading && (
        <p className="aurevi-home-status" style={{ marginTop: 16 }}>
          Consultando alertas...
        </p>
      )}

      {currentUser && errorMsg && (
        <p
          className="aurevi-home-status aurevi-home-status-error"
          style={{ marginTop: 16 }}
        >
          {errorMsg}
        </p>
      )}

      {currentUser && !loading && items.length === 0 && (
        <div
          className="aurevi-feed-card"
          style={{ marginTop: 16, padding: 14, color: "#9ca3af" }}
        >
          Todavía no tienes alertas.
        </div>
      )}

      {currentUser && !loading && items.length > 0 && (
        <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
          <AlertBlock
            title="❤️ Likes"
            subtitle="Personas a las que les gustaron tus videos"
            badge={unreadCounts.likes}
            isOpen={openSection === "likes"}
            onClick={() => toggle("likes")}
            onMarkRead={() => markSectionAsRead("likes")}
          >
            {groups.likes.length === 0 ? (
              <EmptyState text="Cuando alguien dé like a uno de tus videos, aparecerá aquí." />
            ) : (
              <NotificationsList
                list={groups.likes}
                profilesById={profilesById}
                timeAgo={timeAgo}
                onOpen={goToVideo}
                onMarkRead={markOneAsRead}
              />
            )}
          </AlertBlock>

          <AlertBlock
            title="💬 Comentarios"
            subtitle="Respuestas y mensajes en tus videos"
            badge={unreadCounts.comments}
            isOpen={openSection === "comments"}
            onClick={() => toggle("comments")}
            onMarkRead={() => markSectionAsRead("comments")}
          >
            {groups.comments.length === 0 ? (
              <EmptyState text="Los comentarios recientes se mostrarán en esta sección." />
            ) : (
              <NotificationsList
                list={groups.comments}
                profilesById={profilesById}
                timeAgo={timeAgo}
                onOpen={goToVideo}
                onMarkRead={markOneAsRead}
              />
            )}
          </AlertBlock>

          <AlertBlock
            title="👥 Nuevos seguidores"
            subtitle="Personas que comenzaron a seguirte"
            badge={unreadCounts.followers}
            isOpen={openSection === "followers"}
            onClick={() => toggle("followers")}
            onMarkRead={() => markSectionAsRead("followers")}
          >
            {groups.followers.length === 0 ? (
              <EmptyState text="Aquí verás quién se une a tu comunidad creativa." />
            ) : (
              <NotificationsList
                list={groups.followers}
                profilesById={profilesById}
                timeAgo={timeAgo}
                onOpen={goToVideo}
                onMarkRead={markOneAsRead}
              />
            )}
          </AlertBlock>
        </div>
      )}
    </section>
  );
}

/* ---------------- Subcomponentes ---------------- */

function AlertBlock({
  title,
  subtitle,
  badge = 0,
  isOpen,
  onClick,
  onMarkRead,
  children,
}) {
  return (
    <div
      className="aurevi-feed-card"
      style={{
        padding: 14,
        cursor: "pointer",
        border: isOpen
          ? "1px solid rgba(99,102,241,0.6)"
          : "1px solid rgba(148,163,184,0.25)",
        transition: "all 160ms ease",
      }}
      onClick={onClick}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 900,
              color: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>{title}</span>

            {badge > 0 && (
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 10px",
                  borderRadius: 999,
                  background: "rgba(99,102,241,0.25)",
                  border: "1px solid rgba(99,102,241,0.55)",
                  color: "#e5e7eb",
                  fontWeight: 900,
                }}
              >
                {badge}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {badge > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead?.();
              }}
              style={{
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(2,6,23,0.55)",
                color: "#e5e7eb",
                borderRadius: 999,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
              title="Marcar esta sección como leída"
            >
              🗑️ Leer
            </button>
          )}

          <div style={{ fontSize: 18, opacity: 0.8 }}>{isOpen ? "▴" : "▾"}</div>
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid rgba(148,163,184,0.25)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function NotificationsList({ list, profilesById, timeAgo, onOpen, onMarkRead }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {list.map((n) => {
        const actor = n.actor_id ? profilesById[n.actor_id] || null : null;
        const actorName =
          actor?.display_name ||
          (actor?.username ? `@${actor.username}` : null) ||
          (n.actor_id ? "Usuario" : "Sistema");

        const unread = !n.read_at;

        return (
          <div
            key={n.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "start",
              padding: 10,
              borderRadius: 12,
              border: unread
                ? "1px solid rgba(99,102,241,0.55)"
                : "1px solid rgba(148,163,184,0.18)",
              background: unread ? "rgba(99,102,241,0.10)" : "rgba(2,6,23,0.35)",
            }}
          >
            <button
              type="button"
              onClick={() => onOpen?.(n)}
              style={{
                textAlign: "left",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                color: "#e5e7eb",
              }}
              title="Abrir"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900 }}>{actorName}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{timeAgo(n.created_at)}</span>

                {unread && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(236,72,153,0.18)",
                      border: "1px solid rgba(236,72,153,0.35)",
                      color: "#fce7f3",
                      fontWeight: 900,
                    }}
                  >
                    Nuevo
                  </span>
                )}
              </div>

              <div style={{ marginTop: 6, color: "rgba(229,231,235,0.92)", fontSize: 13 }}>
                {n.message || defaultMessage(n.type)}
              </div>

              {n.video_id && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                  ▶ Ir al video
                </div>
              )}
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              {unread ? (
                <button
                  type="button"
                  onClick={() => onMarkRead?.(n.id)}
                  style={{
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(2,6,23,0.55)",
                    color: "#e5e7eb",
                    borderRadius: 999,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                  title="Marcar como leída"
                >
                  🗑️ Leída
                </button>
              ) : (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>✓ Leída</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function defaultMessage(type) {
  if (type === "like") return "Le gustó uno de tus videos.";
  if (type === "comment") return "Comentó en uno de tus videos.";
  if (type === "follow") return "Comenzó a seguirte.";
  return "Nueva actividad.";
}

function EmptyState({ text }) {
  return <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>{text}</div>;
}

export default Notifications;