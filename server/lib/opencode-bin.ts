import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const EXECUTABLE = process.platform === "win32" ? "opencode.exe" : "opencode";

function packagedBin(): string | null {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(moduleDir, "..", "bin", EXECUTABLE), join(moduleDir, "..", "..", "bin", EXECUTABLE)];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found && verifies(found) ? found : null;
}

function bundledBin(): string | null {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const base = `opencode-${platform}-${process.arch}`;
  const variants = [base, `${base}-baseline`, `${base}-musl`, `${base}-baseline-musl`];
  for (const variant of variants) {
    for (const candidate of [`bin/opencode.exe`, `bin/opencode`]) {
      try {
        return require.resolve(`${variant}/${candidate}`);
      } catch {
        continue;
      }
    }
  }
  return null;
}

function systemBin(): string | null {
  const probe = spawnSync("opencode", ["--version"], { encoding: "utf8" });
  return probe.status === 0 && probe.stdout.trim() ? "opencode" : null;
}

function verifies(run: string): boolean {
  const probe = spawnSync(run, ["--version"], { encoding: "utf8" });
  return probe.status === 0 && probe.stdout.trim().length > 0;
}

function preferredBin(): string {
  const override = process.env.BRAINED_OPENCODE_BIN;
  if (override && verifies(override)) {
    return override;
  }
  const packaged = packagedBin();
  if (packaged && verifies(packaged)) {
    return packaged;
  }
  const bundled = bundledBin();
  if (bundled && verifies(bundled)) {
    return bundled;
  }
  const system = systemBin();
  if (system) {
    return system;
  }
  throw new Error(
    "No se encontró OpenCode. Ejecuta npm install para descargar el binario embebido o instala opencode (opencode.ai)."
  );
}

let resolved: string | null = null;

export function resolveOpenCodeBin(): string {
  if (!resolved) {
    resolved = preferredBin();
  }
  return resolved;
}

export function ensureOpenCodeOnPath(): void {
  const run = resolveOpenCodeBin();
  const binDir = dirname(run);
  const parts = process.env.PATH?.split(delimiter) ?? [];
  if (!parts.includes(binDir)) {
    process.env.PATH = [binDir, ...parts].filter(Boolean).join(delimiter);
  }
}