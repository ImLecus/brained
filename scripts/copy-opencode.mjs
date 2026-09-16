import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.platform === "win32" ? "windows" : process.platform;
const base = `opencode-${platform}-${process.arch}`;
const variants = [base, `${base}-baseline`, `${base}-musl`, `${base}-baseline-musl`];
const candidates = [`.exe`, ``].map((ext) => `bin/opencode${ext}`);

let source = null;
for (const variant of variants) {
  for (const candidate of candidates) {
    try {
      source = require.resolve(`${variant}/${candidate}`);
      break;
    } catch {
      continue;
    }
  }
  if (source) {
    break;
  }
}

if (!source) {
  throw new Error(
    `No se encontró el binario de OpenCode para ${process.platform} ${process.arch} en node_modules. Ejecuta npm install.`
  );
}

const targetDir = join(root, "dist-server", "bin");
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, `opencode${process.platform === "win32" ? ".exe" : ""}`));