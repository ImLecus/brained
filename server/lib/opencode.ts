import { createOpencode } from "@opencode-ai/sdk";
import { createServer } from "node:net";
import type { EventBus } from "./events.js";

export type OpenCodeInstance = Awaited<ReturnType<typeof createOpencode>>;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("could not reserve a free port"));
        }
      });
    });
  });
}

export class AgentService {
  private manager: OpenCodeInstance | null = null;
  private model: string | null = null;
  private directory: string | null = null;

  constructor(private events: EventBus) {
    process.once("exit", () => this.manager?.server.close());
    process.once("SIGINT", () => this.manager?.server.close());
    process.once("SIGTERM", () => this.manager?.server.close());
  }

  async ensure(model: string, directory: string): Promise<OpenCodeInstance> {
    if (this.manager && this.model === model && this.directory === directory) {
      return this.manager;
    }
    this.manager?.server.close();
    const port = await freePort();
    const manager = await createOpencode({ port, config: { model } });
    const { stream } = await manager.client.event.subscribe({});
    const forward = async () => {
      for await (const event of stream) {
        this.events.publish(event);
      }
    };
    void forward();
    this.manager = manager;
    this.model = model;
    this.directory = directory;
    return manager;
  }
}