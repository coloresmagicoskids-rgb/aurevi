// src/hooks/usePresence.js
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function usePresence(
  userIds,
  { windowSeconds = 60, pollMs = 20000 } = {}
) {
  const ids = useMemo(() => (userIds || []).filter(Boolean), [userIds]);
  const [map, setMap] = useState({}); // { [userId]: { is_online, last_seen_at } }

  useEffect(() => {
    if (!ids.length) {
      setMap({});
      return;
    }

    let alive = true;
    let interval = null;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_presence", {
        user_ids: ids,
        online_window_seconds: windowSeconds,
      });

      if (!alive) return;

      if (error) {
        console.warn("[presence] rpc error", error);
        return;
      }

      const next = {};
      for (const row of data || []) next[row.user_id] = row;
      setMap(next);
    };

    load();
    interval = setInterval(load, pollMs);

    // Realtime: si cambia last_seen_at, refrescamos rápido
    const channel = supabase
      .channel("presence:user_sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_sessions" },
        (payload) => {
          const uid = payload?.new?.user_id || payload?.old?.user_id;
          if (uid && ids.includes(uid)) load();
        }
      )
      .subscribe();

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [ids.join("|"), windowSeconds, pollMs]);

  return map;
}