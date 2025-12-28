// src/hooks/useRequireUsername.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const withTimeout = (promise, ms = 8000, label = "timeout") =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);

export function useRequireUsername(userId) {
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [profile, setProfile] = useState(null);

  const load = async (uid) => {
    if (!uid) {
      setProfile(null);
      setNeedsUsername(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .eq("id", uid)
          .single(),
        8000,
        "profiles.select timeout"
      );

      if (error) {
        console.error("[profiles] error:", error);
        setProfile(null);
        setNeedsUsername(false);
        setLoading(false);
        return;
      }

      setProfile(data);
      const missing = !data?.username || data.username.trim().length === 0;
      setNeedsUsername(missing);
      setLoading(false);
    } catch (e) {
      console.warn("[profiles] falló o timeout:", e);
      // No bloquees la app por esto
      setProfile(null);
      setNeedsUsername(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await load(userId);
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  return {
    loading,
    needsUsername,
    profile,
    refresh: async () => load(userId),
  };
}