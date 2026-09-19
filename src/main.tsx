import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/app.css";
import "./styles/theme.css";
import "./styles/components/graph.css";
import "./styles/components/chat.css";
import "./styles/components/settings.css";
import "./styles/components/node.css";
import "./styles/components/brain.css";
import "./styles/components/renderer.css";
import "./styles/humanize/humanize.css"

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);