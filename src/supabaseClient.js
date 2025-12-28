// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ayuda a detectar el problema en Vercel (ver Console del navegador)
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[SUPABASE] Variables faltantes:", {
    VITE_SUPABASE_URL: supabaseUrl ? "OK" : "MISSING",
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? "OK" : "MISSING",
  });
}

// Evita crashes raros por URL inválida (y hace el error obvio)
try {
  if (supabaseUrl) new URL(supabaseUrl);
} catch {
  console.error("[SUPABASE] VITE_SUPABASE_URL no es una URL válida:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");