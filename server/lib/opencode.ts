import { createOpencode } from "@opencode-ai/sdk";
import type { EventBus } from "./events";

export type OpenCodeInstance = Awaited<ReturnType<typeof createOpencode>>;

export class AgentService {
  private manager: OpenCodeInstance | null = null;
  private model: string | null = null;

  constructor(private events: EventBus) {}

  async ensure(model: string): Promise<OpenCodeInstance> {
    if (this.manager && this.model === model) {
      return this.manager;
    }
    this.manager?.server.close();
    const manager = await createOpencode({ config: { model } });
    const { stream } = await manager.client.event.subscribe({});
    const forward = async () => {
      for await (const event of stream) {
        this.events.publish(event);
      }
    };
    void forward();
    this.manager = manager;
    this.model = model;
    return manager;
  }
}