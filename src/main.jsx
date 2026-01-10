import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { WorldProvider } from "./worlds/WorldContext.jsx";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <WorldProvider>
        <App />
      </WorldProvider>
    </BrowserRouter>
  </React.StrictMode>
);