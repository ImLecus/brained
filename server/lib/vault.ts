import { basename, extname } from "node:path";
import type { GraphData, GraphLink, GraphNode } from "../../shared/types.js";

const WIKILINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

function documentId(path: string): string {
  return basename(path, extname(path));
}

export function parseBrain(files: Map<string, string>): GraphData {
  const nodes = new Map<string, GraphNode>();
  for (const relative of files.keys()) {
    const id = documentId(relative);
    nodes.set(id, { id, title: id, path: relative });
  }

  const links = new Map<string, GraphLink>();
  for (const [relative, content] of files) {
    const id = documentId(relative);
    for (const match of content.matchAll(WIKILINK_PATTERN)) {
      const target = match[1].trim();
      if (target.length > 0 && target !== id && nodes.has(target)) {
        links.set(`${id}\u0000${target}`, { source: id, target });
      }
    }
  }

  return { nodes: [...nodes.values()], links: [...links.values()] };
}