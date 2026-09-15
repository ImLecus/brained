import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppConfig } from "../../shared/types.ts";

export const CONFIG_PATH = resolve("config.json");

export const DEFAULT_CONFIG: AppConfig = {
  vaultPath: ".",
  instructionsPath: "AGENTS.md",
  model: "opencode/big-pickle",
  language: "es",
  theme: "light",
};

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}