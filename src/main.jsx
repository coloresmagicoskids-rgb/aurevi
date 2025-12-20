import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// src/main.jsx
import { WorldProvider } from "./worlds/WorldContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WorldProvider>
      <App />
    </WorldProvider>
  </React.StrictMode>
);