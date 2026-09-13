import { readFile } from "node:fs/promises";
import { basename, extname, relative } from "node:path";
import fg from "fast-glob";
import type { GraphData, GraphLink, GraphNode } from "../../shared/types";

const WIKILINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

function documentId(path: string): string {
  return basename(path, extname(path));
}

export async function parseVault(rootPath: string): Promise<GraphData> {
  const files = await fg("**/*.md", {
    cwd: rootPath,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  const nodes = new Map<string, GraphNode>();
  const links = new Map<string, GraphLink>();

  for (const file of files) {
    const id = documentId(file);
    nodes.set(id, {
      id,
      title: id,
      path: relative(rootPath, file),
    });
    const content = await readFile(file, "utf8");
    for (const match of content.matchAll(WIKILINK_PATTERN)) {
      const target = match[1].trim();
      if (target.length > 0 && target !== id) {
        links.set(`${id}\u0000${target}`, { source: id, target });
      }
    }
  }

  return { nodes: [...nodes.values()], links: [...links.values()] };
}