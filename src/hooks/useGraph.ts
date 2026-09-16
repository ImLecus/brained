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

function sanitize(graph: GraphData): GraphData {
  const ids = new Set<string>();
  const nodes = graph.nodes.filter((node) => {
    if (typeof node.id !== "string" || node.id.length === 0 || ids.has(node.id)) {
      return false;
    }
    ids.add(node.id);
    return true;
  });
  const links = graph.links.filter(
    (link) =>
      typeof link.source === "string" &&
      typeof link.target === "string" &&
      ids.has(link.source) &&
      ids.has(link.target),
  );
  return { nodes, links };
}

export function useGraph() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const lastSignature = useRef("");
  const requestSeq = useRef(0);

  const refresh = async (): Promise<void> => {
    const seq = ++requestSeq.current;
    try {
      const next = sanitize(await getGraph());
      if (seq !== requestSeq.current) {
        return;
      }
      const nextSignature = signature(next);
      if (nextSignature !== lastSignature.current) {
        lastSignature.current = nextSignature;
        setGraph(next);
        setRevision((value) => value + 1);
      }
    } catch {
      if (seq !== requestSeq.current) {
        return;
      }
      setGraph({ nodes: [], links: [] });
      setRevision((value) => value + 1);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { graph, loading, revision, refresh };
}