import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./lib/config.js";
import { EventBus } from "./lib/events.js";
import { AgentService } from "./lib/opencode.js";
import { registerApi } from "./routes/api.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8300);
const REQUIRED_SDK_VERSION = "1.18.30";

function assertOpencodeVersion(): void {
  const entry = import.meta.resolve("@opencode-ai/sdk");
  const pkgPath = resolve(dirname(fileURLToPath(entry)), "..", "package.json");
  const sdkVersion = JSON.parse(readFileSync(pkgPath, "utf8")).version as string;
  if (sdkVersion !== REQUIRED_SDK_VERSION) {
    throw new Error(
      `BRAINED requiere @opencode-ai/sdk ${REQUIRED_SDK_VERSION} pero se encontró ${sdkVersion}. Actualiza o instala la versión correcta.`
    );
  }
}

async function start(): Promise<void> {
  assertOpencodeVersion();
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