// src/hooks/useRequireUsername.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export function useRequireUsername() {
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (alive) {
          setProfile(null);
          setNeedsUsername(false);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (error) {
        console.error(error);
        setProfile(null);
        setNeedsUsername(false);
        setLoading(false);
        return;
      }

      setProfile(data);
      const missing = !data?.username || data.username.trim().length === 0;
      setNeedsUsername(missing);
      setLoading(false);
    }

    run();

    const { data: sub } = supabase.auth.onAuthStateChange(() => run());

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return { loading, needsUsername, profile, refresh: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("id, username, avatar_url").eq("id", user.id).single();
    setProfile(data);
    setNeedsUsername(!data?.username || data.username.trim().length === 0);
  }};
}
