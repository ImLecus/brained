import type { AgentService, OpenCodeInstance } from "./opencode";

const REPLY_TIMEOUT = 45_000;
const POLL_INTERVAL = 500;

interface ChatMessageEnvelope {
  info: {
    id: string;
    time?: { completed?: number };
    error?: unknown;
  };
  parts?: Array<{ type: string; text?: string }>;
}

function messageText(envelope: ChatMessageEnvelope): string {
  return (envelope.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export class StuckSessionError extends Error {}

export class ChatManager {
  private sessionID: string | null = null;

  async send(agents: AgentService, model: string, text: string): Promise<void> {
    const manager = await agents.ensure(model);
    const sessionID = await this.session(manager);
    const replied = await this.sendOnce(manager, sessionID, text);
    if (replied) {
      return;
    }
    this.sessionID = null;
    throw new StuckSessionError("session_reset");
  }

  private async sendOnce(
    manager: OpenCodeInstance,
    sessionID: string,
    text: string,
  ): Promise<boolean> {
    const result = await manager.client.session.prompt({
      path: { id: sessionID },
      body: { parts: [{ type: "text", text }] },
    });
    if (result.error) {
      throw result.error;
    }
    const assistantID = (result.data as ChatMessageEnvelope | null)?.info?.id;
    if (!assistantID) {
      return false;
    }
    const deadline = Date.now() + REPLY_TIMEOUT;
    while (Date.now() < deadline) {
      const poll = await manager.client.session.message({
        path: { id: sessionID, messageID: assistantID },
      });
      const message = poll.data as ChatMessageEnvelope | null;
      if (!message) {
        return false;
      }
      if (message.info.error) {
        return false;
      }
      if (messageText(message).length > 0 || message.info.time?.completed) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
    return false;
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