// src/worlds/worldTypes.js
// Definición de mundos para AUREVI (versión alineada con WorldSwitcher, Marketplace, etc.)

// IDs internos de mundos
export const WORLD_TYPES = {
  PUBLICO: "publico",
  CREADORES: "creadores",
  INFANTIL: "infantil",
  BIENESTAR: "bienestar",
  EXPERIMENTAL: "experimental",
};

// Etiquetas visibles en la interfaz
export const WORLD_LABELS = {
  publico: "Público",
  creadores: "Creadores",
  infantil: "Infantil",
  bienestar: "Bienestar",
  experimental: "Experimental",
};

// Arreglo de llaves para selects, etc.
export const WORLD_KEYS = Object.values(WORLD_TYPES);