import type { AppConfig, GraphData } from "../../shared/types";

interface ApiError extends Error {
  code?: string;
}

interface ChatResponse {
  ok: boolean;
  error?: string;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    const error = new Error(
      payload?.error ?? `request ${url} failed with status ${response.status}`,
    ) as ApiError;
    error.code = payload?.error;
    throw error;
  }
  return payload as T;
}

export function getGraph(): Promise<GraphData> {
  return json("/api/graph");
}

export async function getNodeContent(path: string): Promise<string> {
  const result = await json<{ content: string }>(
    `/api/node?path=${encodeURIComponent(path)}`,
  );
  return result.content;
}

export function getConfig(): Promise<AppConfig> {
  return json("/api/config");
}

export function updateConfig(config: AppConfig): Promise<AppConfig> {
  return json("/api/config", { method: "PUT", body: JSON.stringify(config) });
}

export async function sendMessage(text: string): Promise<void> {
  const result = await json<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if (!result.ok) {
    const error = new Error(result.error ?? "chat failed") as ApiError;
    error.code = result.error;
    throw error;
  }
}