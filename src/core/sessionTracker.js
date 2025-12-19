// src/core/sessionTracker.js
import { supabase } from "../supabaseClient";

function getDeviceName() {
  try {
    const ua = navigator.userAgent || "";
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad/i.test(ua)) return "iPhone/iPad";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac/i.test(ua)) return "Mac";
    return "Dispositivo";
  } catch {
    return "Dispositivo";
  }
}

function getPlatform() {
  try {
    return navigator.platform || "web";
  } catch {
    return "web";
  }
}

// id estable por dispositivo/navegador
export function getLocalSessionKey() {
  const KEY = "aurevi_session_key_v1";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, v);
  }
  return v;
}

export async function upsertUserSession({ appVersion = null } = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const sessionKey = getLocalSessionKey();

  const payload = {
    user_id: user.id,
    session_key: sessionKey,
    device_name: getDeviceName(),
    platform: getPlatform(),
    app_version: appVersion,
    last_seen_at: new Date().toISOString(),
    revoked_at: null,
  };

  // Requiere índice unique (user_id, session_key)
  await supabase.from("user_sessions").upsert(payload, {
    onConflict: "user_id,session_key",
  });
}

// Actualiza last_seen_at de ESTA sesión (la del navegador actual)
export async function touchSession() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const sessionKey = getLocalSessionKey();

  await supabase
    .from("user_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("session_key", sessionKey)
    .is("revoked_at", null);
}

// ✅ 2.3.4: comprueba si ESTA sesión fue revocada
export async function isCurrentSessionRevoked() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const sessionKey = getLocalSessionKey();

  const { data, error } = await supabase
    .from("user_sessions")
    .select("revoked_at")
    .eq("user_id", user.id)
    .eq("session_key", sessionKey)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return !!data?.revoked_at;
}

// Revoca todas las demás sesiones (menos la actual)
export async function revokeOtherSessions() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const sessionKey = getLocalSessionKey();

  await supabase
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .neq("session_key", sessionKey)
    .is("revoked_at", null);
}