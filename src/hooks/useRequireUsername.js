// src/hooks/useRequireUsername.js
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("useRequireUsername timeout")), ms)
    ),
  ]);
}

export function useRequireUsername(userId) {
  const [loading, setLoading] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [profile, setProfile] = useState(null);
  const reqRef = useRef(0);

  const run = useCallback(async () => {
    const myReq = ++reqRef.current;

    // Si no hay usuario, no hay gate.
    if (!userId) {
      setLoading(false);
      setNeedsUsername(false);
      setProfile(null);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .eq("id", userId)
          .single(),
        8000
      );

      // ignora respuestas viejas
      if (myReq !== reqRef.current) return;

      if (error) {
        console.warn("[useRequireUsername] profiles error:", error);
        // Importante: NO bloquees la app por esto
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
      if (myReq !== reqRef.current) return;
      console.warn("[useRequireUsername] falló o timeout:", e);
      // Importante: NO bloquees la app por esto
      setProfile(null);
      setNeedsUsername(false);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    run();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      run();
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, [run]);

  return {
    loading,
    needsUsername,
    profile,
    refresh: run,
  };
}