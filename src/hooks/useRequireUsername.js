// src/hooks/useRequireUsername.js
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

export function useRequireUsername(userId) {
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [profile, setProfile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);

    // 1) Si App pasa userId úsalo; si no, cae a getUser()
    let uid = userId;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data?.user?.id ?? null;
    }

    if (!uid) {
      setProfile(null);
      setNeedsUsername(false);
      setLoading(false);
      return;
    }

    // 2) maybeSingle: si no hay fila, NO lanza error duro
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", uid)
      .maybeSingle();

    // 3) Si hay error real (RLS / permisos / etc), mejor pedir username
    //    porque no podemos confirmar el perfil.
    if (error) {
      console.error("[useRequireUsername] profiles read error:", error);
      setProfile(null);
      setNeedsUsername(true); // 👈 importante
      setLoading(false);
      return;
    }

    // 4) Si no existe perfil, también pedir username (o crear perfil)
    if (!data) {
      setProfile(null);
      setNeedsUsername(true);
      setLoading(false);
      return;
    }

    setProfile(data);
    const missing = !data.username || data.username.trim().length === 0;
    setNeedsUsername(missing);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!alive) return;
      await load();
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange(() => run());

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [load]);

  return {
    loading,
    needsUsername,
    profile,
    refresh: load,
  };
}