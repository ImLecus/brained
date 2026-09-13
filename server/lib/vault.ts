import { readFile } from "node:fs/promises";
import { basename, extname, relative } from "node:path";
import fg from "fast-glob";
import type { GraphData, GraphLink, GraphNode } from "../../shared/types";

const WIKILINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const IGNORED = ["**/node_modules/**", "**/dist/**", "**/.git/**"];

const cache = new Map<string, GraphData>();

export function invalidateVault(rootPath: string): void {
  cache.delete(rootPath);
}

function documentId(path: string): string {
  return basename(path, extname(path));
}

async function discover(rootPath: string): Promise<string[]> {
  return fg("**/*.md", { cwd: rootPath, absolute: true, ignore: IGNORED });
}

async function buildGraph(
  files: string[],
  rootPath: string,
): Promise<GraphData> {
  const contents = await Promise.all(
    files.map((file) => readFile(file, "utf8").catch(() => "")),
  );
  const nodes = new Map<string, GraphNode>();
  const links = new Map<string, GraphLink>();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const id = documentId(file);
    nodes.set(id, {
      id,
      title: id,
      path: relative(rootPath, file),
    });
    const content = contents[index];
    for (const match of content.matchAll(WIKILINK_PATTERN)) {
      const target = match[1].trim();
      if (target.length > 0 && target !== id) {
        links.set(`${id}\u0000${target}`, { source: id, target });
      }
    }
  }

  return { nodes: [...nodes.values()], links: [...links.values()] };
}

export async function parseVault(rootPath: string): Promise<GraphData> {
  const cached = cache.get(rootPath);
  if (cached) {
    return cached;
  }
  const files = (await discover(rootPath)).sort();
  const data = await buildGraph(files, rootPath);
  cache.set(rootPath, data);
  return data;
}