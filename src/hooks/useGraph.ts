import { useEffect, useState } from "react";
import type { GraphData } from "../../shared/types";
import { getGraph } from "../api/client";

export function useGraph() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  const refresh = async (): Promise<void> => {
    try {
      const next = await getGraph();
      setGraph(next);
    } catch {
      setGraph({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { graph, loading, refresh };
}