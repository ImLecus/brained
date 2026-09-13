import { useState } from "react";
import { ConfigProvider, useConfig } from "./context/ConfigContext";
import { useGraph } from "./hooks/useGraph";
import { useI18n } from "./hooks/useI18n";
import { GraphView } from "./components/GraphView";
import { ChatPanel } from "./components/ChatPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SettingsIcon } from "./components/SettingsIcon";

function Workspace() {
  const { config } = useConfig();
  const { t } = useI18n();
  const { graph, refresh } = useGraph();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!config) {
    return <div className="shell" />;
  }

  const color = config.theme === "dark" ? "#ebebeb" : "#0d0d0d";

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="brand">{t("app.name")}</h1>
        <button className="topbar-action" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </button>
      </header>
      <main className="workspace">
        <section className="graph-pane">
          <GraphView graph={graph} color={color} />
        </section>
        <ChatPanel onFilesChanged={() => void refresh()} />
      </main>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export function App() {
  return (
    <ConfigProvider>
      <Workspace />
    </ConfigProvider>
  );
}