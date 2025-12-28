// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔴 Guardia crítica: evita loading infinito en producción
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[SUPABASE] Variables de entorno faltantes:", {
    VITE_SUPABASE_URL: supabaseUrl ? "OK" : "MISSING",
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? "OK" : "MISSING",
  });

  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa Vercel → Settings → Environment Variables."
  );
}

// 🔴 Validación de URL (defensiva)
try {
  new URL(supabaseUrl);
} catch {
  throw new Error(
    `[SUPABASE] VITE_SUPABASE_URL no es una URL válida: ${supabaseUrl}`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);