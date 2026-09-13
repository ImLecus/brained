import type { AppConfig, GraphData } from "../../shared/types";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`request ${url} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getGraph(): Promise<GraphData> {
  return json("/api/graph");
}

export function getConfig(): Promise<AppConfig> {
  return json("/api/config");
}

export function updateConfig(config: AppConfig): Promise<AppConfig> {
  return json("/api/config", { method: "PUT", body: JSON.stringify(config) });
}

export function sendMessage(text: string): Promise<{ ok: boolean }> {
  return json("/api/chat", { method: "POST", body: JSON.stringify({ text }) });
}