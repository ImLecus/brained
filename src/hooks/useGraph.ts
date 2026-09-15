import { useEffect, useRef, useState } from "react";
import type { GraphData } from "../../shared/types";
import { getGraph } from "../api/client";

function signature(graph: GraphData): string {
  const nodes = graph.nodes
    .map((node) => `${node.id}\u0000${node.path}`)
    .sort()
    .join("|");
  const links = graph.links
    .map((link) => `${link.source}\u0001${link.target}`)
    .sort()
    .join("|");
  return `${nodes}\u0002${links}`;
}

export function useGraph() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const lastSignature = useRef("");

  const refresh = async (): Promise<void> => {
    try {
      const next = await getGraph();
      const nextSignature = signature(next);
      if (nextSignature !== lastSignature.current) {
        lastSignature.current = nextSignature;
        setGraph(next);
      }
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