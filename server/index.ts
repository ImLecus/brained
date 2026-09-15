import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./lib/config.js";
import { EventBus } from "./lib/events.js";
import { AgentService } from "./lib/opencode.js";
import { registerApi } from "./routes/api.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8300);

async function start(): Promise<void> {
  const config = await loadConfig();
  const events = new EventBus();
  const agents = new AgentService(events);
  const app = Fastify({ logger: true });

  const dist = resolve(process.env.BRAINED_DIST ?? "dist");
  if (process.env.BRAINED_DIST || existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist });
  }

  await registerApi(app, { config, events, agents });
  await app.listen({ host: HOST, port: PORT });
  console.log(`BRAINED:READY http://${HOST}:${PORT}`);
}

void start();