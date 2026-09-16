import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { AppConfig } from "../../shared/types.ts";

export const VAULT_DIR = join(homedir(), "brained");

export const CONFIG_PATH = resolve("config.json");

export const DEFAULT_CONFIG: AppConfig = {
  model: "opencode/big-pickle",
  language: "es",
  theme: "light",
};

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const loaded: AppConfig & { instructionsPath?: string; vaultPath?: string } = {
      ...DEFAULT_CONFIG,
      ...JSON.parse(raw),
    };
    delete loaded.instructionsPath;
    delete loaded.vaultPath;
    return loaded;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}