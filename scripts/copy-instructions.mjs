import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "server", "instructions");
const target = join(root, "dist-server", "server", "instructions");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of readdirSync(source)) {
  copyFileSync(join(source, file), join(target, file));
}