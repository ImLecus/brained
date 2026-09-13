import type { AgentService, OpenCodeInstance } from "./opencode";

export class ChatManager {
  private sessionID: string | null = null;

  async send(agents: AgentService, model: string, text: string): Promise<void> {
    const manager = await agents.ensure(model);
    const sessionID = await this.session(manager);
    const result = await manager.client.session.prompt({
      path: { id: sessionID },
      body: { parts: [{ type: "text", text }] },
    });
    if (result.error) {
      throw result.error;
    }
  }

  private async session(manager: OpenCodeInstance): Promise<string> {
    if (!this.sessionID) {
      const created = await manager.client.session.create({});
      if (created.error) {
        throw created.error;
      }
      const id = created.data.id;
      this.sessionID = id;
      return id;
    }
    return this.sessionID;
  }
}