import type { AppConfig, BrainInfo, BrainStatus, GraphData } from "../../shared/types";

interface ApiError extends Error {
  code?: string;
}

interface ChatResponse {
  ok: boolean;
  error?: string;
  message?: string;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  const payload = await response.json().catch(() => null) as {
    error?: string;
    message?: string;
  } | null;
  if (!response.ok) {
    const error = new Error(
      payload?.message ??
        payload?.error ??
        `request ${url} failed with status ${response.status}`,
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
    const error = new Error(result.message ?? result.error ?? "chat failed") as ApiError;
    error.code = result.error;
    throw error;
  }
}

export function abortChat(): Promise<ChatResponse> {
  return json<ChatResponse>("/api/chat/abort", { method: "POST" });
}

export function getBrainStatus(): Promise<BrainStatus> {
  return json("/api/brain/status");
}

export function listBrains(): Promise<BrainInfo[]> {
  return json("/api/brain/list");
}

export function createBrain(name: string, password: string): Promise<BrainStatus> {
  return json("/api/brain/create", {
    method: "POST",
    body: JSON.stringify({ name, password }),
  });
}

export function openBrain(path: string, password: string): Promise<BrainStatus> {
  return json("/api/brain/open", {
    method: "POST",
    body: JSON.stringify({ path, password }),
  });
}

export function closeBrain(): Promise<BrainStatus> {
  return json("/api/brain/close", { method: "POST" });
}