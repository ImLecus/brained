import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./lib/config";
import { EventBus } from "./lib/events";
import { AgentService } from "./lib/opencode";
import { registerApi } from "./routes/api";

const HOST = "127.0.0.1";
const PORT = 8300;

async function start(): Promise<void> {
  const config = await loadConfig();
  const events = new EventBus();
  const agents = new AgentService(events);
  const app = Fastify({ logger: true });

  const dist = resolve("dist");
  if (existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist });
  }

  await registerApi(app, { config, events, agents });
  await app.listen({ host: HOST, port: PORT });
}

void start();