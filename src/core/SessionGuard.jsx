// src/core/SessionGuard.jsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const SESSION_STORAGE_KEY = "aurevi_session_id";

function getSessionId() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function SessionGuard({ user, children }) {
  const [blocked, setBlocked] = useState(false);
  const channelRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const uid = user?.id;
    const sid = getSessionId();

    // Si no hay sesión o usuario, no vigilamos
    if (!uid || !sid) {
      setBlocked(false);
      return;
    }

    let cancelled = false;

    const forceLogout = async () => {
      if (cancelled) return;
      setBlocked(true);
      try {
        // cerramos sesión local
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("signOut error:", e?.message);
      }
    };

    // 1) Chequeo inmediato al montar
    const checkNow = async () => {
      try {
        const { data, error } = await supabase
          .from("user_sessions")
          .select("revoked_at")
          .eq("user_id", uid)
          .eq("session_id", sid)
          .maybeSingle();

        if (error) throw error;

        // Si no existe fila aún, no bloqueamos (se creará con el upsert del drawer o del heartbeat)
        if (data?.revoked_at) {
          await forceLogout();
        } else {
          setBlocked(false);
        }
      } catch (e) {
        // No bloqueamos por error de red; lo vuelve a intentar el polling
        console.warn("SessionGuard checkNow:", e?.message);
      }
    };

    checkNow();

    // 2) Realtime: si alguien revoca esta sesión => logout
    // Nota: esto requiere que Realtime esté activo para la tabla.
    try {
      const ch = supabase
        .channel(`session-guard:${uid}:${sid}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_sessions",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload?.new;
            if (!row) return;
            if (String(row.session_id) !== String(sid)) return;
            if (row.revoked_at) forceLogout();
          }
        )
        .subscribe();

      channelRef.current = ch;
    } catch (e) {
      console.warn("Realtime subscribe failed:", e?.message);
    }

    // 3) Polling de respaldo cada 12s
    pollRef.current = setInterval(checkNow, 12_000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  // Pantalla de bloqueo simple (puedes estilizarla luego)
  if (blocked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          background: "rgba(2,6,23,0.98)",
          color: "#e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.75)",
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
            Sesión cerrada remotamente
          </div>
          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>
            Esta sesión fue cerrada desde otro dispositivo. Vuelve a iniciar sesión
            para continuar.
          </div>
        </div>
      </div>
    );
  }

  return children;
}
