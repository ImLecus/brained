import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceManyBody } from "d3-force";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphData } from "../../shared/types";

interface GraphViewProps {
  graph: GraphData;
  color: string;
}

const CHARGE = 30;

function degreeMap(graph: GraphData) {
  const degrees = new Map<string, number>();
  for (const link of graph.links) {
    for (const end of [link.source, link.target]) {
      const id = String(end);
      degrees.set(id, (degrees.get(id) ?? 0) + 1);
    }
  }
  return degrees;
}

interface SimNode {
  id?: string | number;
}

export function GraphView({ graph, color }: GraphViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const degrees = useMemo(() => degreeMap(graph), [graph]);
  const nodeVal = useCallback(
    (node: SimNode) => (degrees.get(String(node.id)) ?? 0) + 1,
    [degrees],
  );

  useEffect(() => {
    graphRef.current?.d3Force(
      "charge",
      forceManyBody().strength((node) => {
        const id = (node as SimNode).id;
        return -CHARGE * ((id === undefined ? 0 : degrees.get(String(id))) ?? 1);
      }),
    );
  }, [degrees]);

  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const measure = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={container} className="graph-area">
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graph}
          width={size.width}
          height={size.height}
          backgroundColor="transparent"
          nodeColor={() => color}
          linkColor={() => color}
          nodeLabel={(node) => String(node.id)}
          nodeVal={nodeVal}
          nodeRelSize={4}
          linkWidth={1}
        />
      )}
    </div>
  );
}