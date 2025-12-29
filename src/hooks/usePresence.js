// src/hooks/usePresence.js
import { useMemo } from "react";

/**
 * Hook simple (stub):
 * Devuelve { userId: { is_online: false } }
 * Luego lo conectamos a Supabase Realtime Presence.
 */
export function usePresence(userIds = []) {
  return useMemo(() => {
    const map = {};
    for (const id of userIds || []) {
      if (id) map[id] = { is_online: false };
    }
    return map;
  }, [Array.isArray(userIds) ? userIds.join(",") : ""]);
}