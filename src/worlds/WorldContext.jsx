// src/worlds/WorldContext.jsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { WORLD_TYPES } from "./worldTypes";

const WorldContext = createContext();

const STORAGE_KEY = "aurevi_active_world";
const VALID_WORLDS = new Set(Object.values(WORLD_TYPES || {}));

// ✅ settings para permisos (MVP)
const PIN_STORAGE_KEY = "aurevi_infantil_pin"; // PIN configurado
const PIN_UNLOCK_KEY = "aurevi_infantil_unlocked"; // sesión desbloqueada (opcional)
const DEFAULT_PIN = "1234"; // cámbialo cuando quieras

function getInitialWorld() {
  if (typeof window === "undefined") return WORLD_TYPES.PUBLICO;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID_WORLDS.has(saved)) return saved;
  } catch {}
  return WORLD_TYPES.PUBLICO;
}

function getInfantilPin() {
  if (typeof window === "undefined") return DEFAULT_PIN;
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
  } catch {
    return DEFAULT_PIN;
  }
}

function isInfantilUnlocked() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PIN_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function setInfantilUnlocked(v) {
  try {
    sessionStorage.setItem(PIN_UNLOCK_KEY, v ? "1" : "0");
  } catch {}
}

export function WorldProvider({ children }) {
  const [activeWorld, _setActiveWorld] = useState(getInitialWorld);

  // ✅ UI state para pedir PIN (lo consumirá el Header / WorldSwitcher)
  const [worldGate, setWorldGate] = useState({
    open: false,
    targetWorld: null,
    reason: "",
  });

  const requestWorldChange = (targetWorld) => {
    if (!VALID_WORLDS.has(targetWorld)) return;

    // ✅ regla: INFANTIL requiere PIN
    if (targetWorld === WORLD_TYPES.INFANTIL && !isInfantilUnlocked()) {
      setWorldGate({
        open: true,
        targetWorld,
        reason: "PIN_REQUIRED",
      });
      return;
    }

    _setActiveWorld(targetWorld);
    try {
      localStorage.setItem(STORAGE_KEY, String(targetWorld));
    } catch {}
  };

  const submitWorldPin = (pin) => {
    const target = worldGate.targetWorld;
    if (!target) return { ok: false, error: "NO_TARGET" };

    // Solo estamos protegiendo Infantil por ahora
    if (target !== WORLD_TYPES.INFANTIL) return { ok: false, error: "INVALID_TARGET" };

    const correct = String(pin || "") === String(getInfantilPin());

    if (!correct) {
      return { ok: false, error: "BAD_PIN" };
    }

    // ✅ desbloquea esta sesión
    setInfantilUnlocked(true);

    // ✅ entra al mundo
    requestWorldChange(target);

    // ✅ cierra gate
    setWorldGate({ open: false, targetWorld: null, reason: "" });

    return { ok: true };
  };

  const closeWorldGate = () => {
    setWorldGate({ open: false, targetWorld: null, reason: "" });
  };

  const ctxValue = useMemo(
    () => ({
      activeWorld,
      setActiveWorld: requestWorldChange, // 👈 ahora pasa por permisos
      worldGate,
      submitWorldPin,
      closeWorldGate,

      // opcional: helpers por si luego quieres settings
      setInfantilPin: (pin) => {
        try {
          localStorage.setItem(PIN_STORAGE_KEY, String(pin));
        } catch {}
      },
      lockInfantil: () => setInfantilUnlocked(false),
    }),
    [activeWorld, worldGate]
  );

  return <WorldContext.Provider value={ctxValue}>{children}</WorldContext.Provider>;
}

export function useWorld() {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error("useWorld debe usarse dentro de <WorldProvider>");
  return ctx;
}