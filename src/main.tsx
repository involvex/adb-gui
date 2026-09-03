import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AnnouncerProvider } from "./announcer";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AnnouncerProvider>
      <App />
    </AnnouncerProvider>
  </React.StrictMode>,
);
