import React, { createContext, useContext, useState } from "react";
import { WORLD_TYPES } from "./worldTypes";

const WorldContext = createContext();

export function WorldProvider({ children }) {
  const [activeWorld, setActiveWorld] = useState(WORLD_TYPES.PUBLICO);

  const value = {
    activeWorld,
    setActiveWorld,
  };

  return (
    <WorldContext.Provider value={value}>{children}</WorldContext.Provider>
  );
}

export function useWorld() {
  const ctx = useContext(WorldContext);
  if (!ctx) {
    throw new Error("useWorld debe usarse dentro de <WorldProvider>");
  }
  return ctx;
}
