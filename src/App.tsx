import { useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode } from "../shared/types";
import { ConfigProvider, useConfig } from "./context/ConfigContext";
import { useGraph } from "./hooks/useGraph";
import { useI18n } from "./hooks/useI18n";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GraphView } from "./components/GraphView";
import { ChatPanel } from "./components/ChatPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SettingsIcon } from "./components/SettingsIcon";
import { NodeModal } from "./components/NodeModal";

function resolveNode(target: string, graph: GraphData): GraphNode | undefined {
  const query = target.replace(/^\.\//, "").replace(/\.md$/, "").trim();
  if (query.length === 0) {
    return undefined;
  }
  return (
    graph.nodes.find((node) => node.id === query) ??
    graph.nodes.find((node) => {
      const path = node.path.replace(/\.md$/, "");
      return path === query || path.endsWith(`/${query}`);
    })
  );
}

function Workspace() {
  const { config } = useConfig();
  const { t } = useI18n();
  const { graph, revision, refresh } = useGraph();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const refreshTimer = useRef<number | undefined>(undefined);

  const requestRefresh = () => {
    if (refreshTimer.current !== undefined) {
      window.clearTimeout(refreshTimer.current);
    }
    refreshTimer.current = window.setTimeout(() => void refresh(), 500);
  };

  useEffect(() => {
    return () => {
      if (refreshTimer.current !== undefined) {
        window.clearTimeout(refreshTimer.current);
      }
    };
  }, []);

  if (!config) {
    return <div className="shell" />;
  }

  const color = config.theme === "dark" ? "#ebebeb" : "#0d0d0d";
  const invertColor = config.theme === "dark" ? "#0d0d0d" : "#ffffff";

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
          <ErrorBoundary resetKey={revision}>
            <GraphView
              graph={graph}
              color={color}
              invertColor={invertColor}
              onNodeClick={setSelectedNode}
            />
          </ErrorBoundary>
        </section>
        <ChatPanel onFilesChanged={requestRefresh} />
      </main>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {selectedNode && (
        <NodeModal
          node={selectedNode}
          onNavigate={(target) => {
            const node = resolveNode(target, graph);
            if (node) {
              setSelectedNode(node);
            }
          }}
          onClose={() => setSelectedNode(null)}
        />
      )}
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