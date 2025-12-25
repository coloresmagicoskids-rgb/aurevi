// src/components/ChooseUsernameModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const USER_RE = /^[a-z0-9](?:[a-z0-9_]{1,18})[a-z0-9]$/; // 3-20

export default function ChooseUsernameModal({ open, onDone }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle"); // idle | checking | ok | taken | invalid
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const inputRef = useRef(null);

  const normalized = useMemo(() => {
    let t = (value || "").trim().toLowerCase();
    if (t.startsWith("@")) t = t.slice(1);
    return t;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    setValue("");
    setStatus("idle");
    setErr("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Check disponibilidad (debounced)
  useEffect(() => {
    if (!open) return;
    setErr("");

    const t = setTimeout(async () => {
      if (!normalized) {
        setStatus("idle");
        return;
      }
      if (!USER_RE.test(normalized)) {
        setStatus("invalid");
        return;
      }

      setStatus("checking");
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", normalized)
        .limit(1);

      if (error) {
        console.error(error);
        setStatus("idle");
        return;
      }

      setStatus((data?.length || 0) > 0 ? "taken" : "ok");
    }, 250);

    return () => clearTimeout(t);
  }, [open, normalized]);

  const canSave = status === "ok" && !saving;

  const save = async () => {
    setErr("");
    if (!USER_RE.test(normalized)) {
      setStatus("invalid");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_username", { new_username: normalized });
      if (error) {
        // si choca por índice unique:
        if (String(error.code) === "23505") {
          setStatus("taken");
          setErr("Ese username ya está tomado.");
          return;
        }
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("already taken")) {
          setStatus("taken");
          setErr("Ese username ya está tomado.");
          return;
        }
        if (msg.includes("invalid username format")) {
          setStatus("invalid");
          setErr("Formato inválido. Usa 3-20 caracteres: letras, números, _");
          return;
        }
        setErr(error.message || "No se pudo guardar.");
        return;
      }

      onDone?.(normalized);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const helper =
    status === "invalid"
      ? "Formato: 3-20 chars, letras/números/_ (no puede empezar/terminar con _)."
      : status === "checking"
      ? "Verificando disponibilidad…"
      : status === "taken"
      ? "Ese username ya existe."
      : status === "ok"
      ? "Disponible ✅"
      : "Ej: @carlos_polanco";

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:999999, background:"rgba(0,0,0,0.65)",
      display:"grid", placeItems:"center", padding:16
    }}>
      <div style={{
        width:"min(520px, 96vw)",
        background:"rgba(10,16,32,0.95)",
        border:"1px solid rgba(255,255,255,0.12)",
        borderRadius:18,
        padding:16,
        color:"white"
      }}>
        <div style={{fontWeight:900, fontSize:18}}>Elige tu username</div>
        <div style={{opacity:0.75, marginTop:6, fontSize:13}}>
          Esto será tu identidad pública para búsquedas y mensajes.
        </div>

        <div style={{marginTop:14}}>
          <input
            ref={inputRef}
            value={value}
            onChange={(e)=>setValue(e.target.value)}
            placeholder="Ej: @carlos_polanco"
            style={{
              width:"100%", padding:"12px 12px", borderRadius:12,
              background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.12)",
              color:"white", outline:"none"
            }}
          />
          <div style={{marginTop:8, fontSize:12, opacity:0.8}}>
            {helper}
          </div>
          {err && <div style={{marginTop:8, fontSize:12, color:"#fca5a5"}}>{err}</div>}
        </div>

        <div style={{display:"flex", justifyContent:"flex-end", gap:10, marginTop:16}}>
          <button
            onClick={save}
            disabled={!canSave}
            style={{
              padding:"10px 12px",
              borderRadius:12,
              border:"1px solid rgba(255,255,255,0.12)",
              background: canSave ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
              color:"white",
              fontWeight:900,
              cursor: canSave ? "pointer" : "not-allowed"
            }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
