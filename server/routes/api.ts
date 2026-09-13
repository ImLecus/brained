import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../../shared/types";
import { saveConfig } from "../lib/config";
import { invalidateVault, parseVault } from "../lib/vault";
import type { EventBus } from "../lib/events";
import type { AgentService } from "../lib/opencode";
import { ChatManager, StuckSessionError } from "../lib/chat";

interface ApiDeps {
  config: AppConfig;
  events: EventBus;
  agents: AgentService;
}

interface ChatBody {
  text?: string;
}

export async function registerApi(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const chat = new ChatManager();
  deps.events.subscribe((event) => {
    const type = (event as { type?: string }).type;
    if (type === "file.edited" || type === "file.watcher.updated") {
      invalidateVault(deps.config.vaultPath);
    }
  });

  app.get("/api/graph", async () => parseVault(deps.config.vaultPath));

  app.get("/api/node", async (
    request: FastifyRequest<{ Querystring: { path?: string } }>,
    reply,
  ) => {
    const rel = request.query.path ?? "";
    const escaped = relative(deps.config.vaultPath, join(deps.config.vaultPath, rel));
    if (rel.length === 0 || escaped.startsWith("..") || isAbsolute(escaped)) {
      return reply.code(400).send({ error: "invalid path" });
    }
    try {
      const resolved = join(deps.config.vaultPath, rel);
      const content = await readFile(resolved, "utf8");
      return reply.send({ path: rel, content });
    } catch (error) {
      return reply.code(404).send({ error: String(error) });
    }
  });

  app.get("/api/config", async () => deps.config);

  app.put("/api/config", async (request: FastifyRequest<{ Body: Partial<AppConfig> }>) => {
    Object.assign(deps.config, request.body);
    await saveConfig(deps.config);
    return deps.config;
  });

  app.post("/api/chat", async (
    request: FastifyRequest<{ Body: ChatBody }>,
    reply,
  ) => {
    const text = request.body?.text?.trim() ?? "";
    if (text.length === 0) {
      return reply.code(400).send({ error: "text is required" });
    }
    try {
      await chat.send(deps.agents, deps.config.model, text);
    } catch (error) {
      if (error instanceof StuckSessionError) {
        return reply.send({ ok: false, error: "session_reset" });
      }
      return reply.code(500).send({ error: String(error) });
    }
    return { ok: true };
  });

  app.get("/api/chat/events", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write("retry: 3000\n\n");
    const unsubscribe = deps.events.subscribe((event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    request.raw.on("close", unsubscribe);
  });
}