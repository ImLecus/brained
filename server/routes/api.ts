import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../../shared/types.js";
import { saveConfig } from "../lib/config.js";
import { parseBrain } from "../lib/vault.js";
import type { EventBus } from "../lib/events.js";
import type { AgentService } from "../lib/opencode.js";
import type { BrainService } from "../lib/brain.js";
import { ChatManager, StuckSessionError, PromptTimeoutError, AgentAbortError } from "../lib/chat.js";

interface ApiDeps {
  config: AppConfig;
  events: EventBus;
  agents: AgentService;
  brain: BrainService;
}

interface ChatBody {
  text?: string;
}

interface BrainCreateBody {
  name?: string;
  password?: string;
}

interface BrainOpenBody {
  path?: string;
  password?: string;
}

function errorWithCode(error: unknown, status: number): {
  code: number;
  body: { error: string };
} {
  const code = (error as { code?: string }).code ?? "internal";
  const mappings: Record<string, number> = {
    invalid_password: 401,
    invalid_file: 400,
    invalid_name: 400,
    exists: 409,
    no_brain: 400,
  };
  return { code: mappings[code] ?? status, body: { error: code } };
}

async function bounded<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

export async function registerApi(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const chat = new ChatManager(deps.events);
  deps.events.subscribe(async (event) => {
    const type = (event as { type?: string }).type;
    if (type === "file.edited" || type === "file.watcher.updated") {
      try {
        await deps.brain.syncFromDisk();
        await deps.brain.save();
      } catch (error) {
        app.log.error(`brain resync failed: ${String(error)}`);
      }
    }
  });

  app.get("/api/brain/status", async () => deps.brain.status());

  app.get("/api/brain/list", async () => deps.brain.list());

  app.post("/api/brain/create", async (
    request: FastifyRequest<{ Body: BrainCreateBody }>,
    reply,
  ) => {
    const name = request.body?.name ?? "";
    const password = request.body?.password ?? "";
    if (!name || !password) {
      return reply.code(400).send({ error: "missing_fields" });
    }
    try {
      await deps.brain.create(name, password);
      return reply.send(deps.brain.status());
    } catch (error) {
      const mapped = errorWithCode(error, 500);
      return reply.code(mapped.code).send(mapped.body);
    }
  });

  app.post("/api/brain/open", async (
    request: FastifyRequest<{ Body: BrainOpenBody }>,
    reply,
  ) => {
    const path = request.body?.path ?? "";
    const password = request.body?.password ?? "";
    if (!path || !password) {
      return reply.code(400).send({ error: "missing_fields" });
    }
    try {
      await deps.brain.open(path, password);
      return reply.send(deps.brain.status());
    } catch (error) {
      const mapped = errorWithCode(error, 500);
      return reply.code(mapped.code).send(mapped.body);
    }
  });

  app.post("/api/brain/close", async (_, reply) => {
    try {
      await bounded(chat.abort(), 1500).catch(() => undefined);
      chat.reset();
      await deps.brain.close();
      return reply.send(deps.brain.status());
    } catch (error) {
      const mapped = errorWithCode(error, 500);
      return reply.code(mapped.code).send(mapped.body);
    }
  });

  app.get("/api/graph", async () => {
    await deps.brain.syncFromDisk();
    return parseBrain(deps.brain.files());
  });

  app.get("/api/node", async (
    request: FastifyRequest<{ Querystring: { path?: string } }>,
    reply,
  ) => {
    const rel = request.query.path ?? "";
    if (rel.length === 0 || rel.split("/").includes("..")) {
      return reply.code(400).send({ error: "invalid path" });
    }
    const content = deps.brain.file(rel);
    if (content === null) {
      return reply.code(404).send({ error: "not found" });
    }
    return reply.send({ path: rel, content });
  });

  app.get("/api/config", async () => deps.config);

  app.put("/api/config", async (request: FastifyRequest<{ Body: Partial<AppConfig> }>) => {
    const next = request.body;
    Object.assign(deps.config, next);
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
    let directory: string;
    try {
      directory = deps.brain.workDir();
    } catch (error) {
      const mapped = errorWithCode(error, 400);
      return reply.code(mapped.code).send(mapped.body);
    }
    try {
      await chat.send(
        deps.agents,
        deps.config.model,
        text,
        directory,
      );
    } catch (error) {
      if (error instanceof StuckSessionError) {
        return reply.send({ ok: false, error: "session_reset" });
      }
      if (error instanceof PromptTimeoutError) {
        return reply.send({ ok: false, error: "prompt_timeout" });
      }
      if (error instanceof AgentAbortError) {
        return reply.send({ ok: false, error: "aborted" });
      }
      return reply.send({ ok: false, error: "agent_error", message: String(error) });
    }
    return { ok: true };
  });

  app.post("/api/chat/abort", async () => {
    await chat.abort();
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
    const heartbeat = setInterval(() => {
      reply.raw.write(":\n\n");
    }, 15_000);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}