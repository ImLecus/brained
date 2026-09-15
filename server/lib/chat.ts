import type { AgentService, OpenCodeInstance } from "./opencode.js";
import type { EventBus } from "./events.js";

const REPLY_TIMEOUT = 45_000;
const PROMPT_TIMEOUT = 120_000;
const POLL_INTERVAL = 500;

interface ChatMessageEnvelope {
  info: {
    id: string;
    time?: { completed?: number };
    error?: unknown;
  };
  parts?: Array<{ type: string; text?: string }>;
}

interface QueuedMessage {
  text: string;
  directory: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

function messageText(envelope: ChatMessageEnvelope): string {
  return (envelope.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export class StuckSessionError extends Error {}

export class PromptTimeoutError extends Error {}

export class AgentAbortError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, error: Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(error), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

interface ReplyEnvelope {
  id: string;
  text: string;
}

export class ChatManager {
  private manager: OpenCodeInstance | null = null;
  private sessionID: string | null = null;
  private directory: string | null = null;
  private busy = false;
  private aborted = false;
  private queue: QueuedMessage[] = [];

  constructor(private events: EventBus) {}

  async send(
    agents: AgentService,
    model: string,
    text: string,
    directory: string,
  ): Promise<void> {
    if (this.busy) {
      await this.waitForQueue(text, directory);
      return;
    }
    this.busy = true;
    try {
      await this.run(agents, model, text, directory);
    } finally {
      this.busy = false;
      void this.drain(agents, model);
    }
  }

  async abort(): Promise<void> {
    this.aborted = true;
    if (this.manager && this.sessionID && this.directory) {
      await this.manager.client.session.abort({
        path: { id: this.sessionID },
        query: { directory: this.directory },
      });
    }
  }

  private async drain(agents: AgentService, model: string): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      return;
    }
    this.busy = true;
    try {
      await this.run(agents, model, next.text, next.directory);
      next.resolve();
    } catch (error) {
      next.reject(error as Error);
    } finally {
      this.busy = false;
      void this.drain(agents, model);
    }
  }

  private waitForQueue(text: string, directory: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ text, directory, resolve, reject });
    });
  }

  private async run(
    agents: AgentService,
    model: string,
    text: string,
    directory: string,
  ): Promise<void> {
    this.aborted = false;
    const manager = await agents.ensure(model, directory);
    this.manager = manager;
    const sessionID = await this.session(manager, directory);
    try {
      const reply = await this.sendOnce(manager, sessionID, text, directory);
      if (!reply) {
        this.resetSession();
        throw new StuckSessionError("session_reset");
      }
      this.publishReply(reply);
    } catch (error) {
      if (error instanceof PromptTimeoutError) {
        await this.abort();
        this.resetSession();
      }
      throw error;
    }
  }

  private async sendOnce(
    manager: OpenCodeInstance,
    sessionID: string,
    text: string,
    directory: string,
  ): Promise<ReplyEnvelope | null> {
    const result = await withTimeout(
      manager.client.session.prompt({
        path: { id: sessionID },
        query: { directory },
        body: { parts: [{ type: "text", text }] },
      }),
      PROMPT_TIMEOUT,
      new PromptTimeoutError("prompt_timeout"),
    );
    if (result.error) {
      throw new Error(`agente (request): ${String(result.error)}`);
    }
    const assistantID = (result.data as ChatMessageEnvelope | null)?.info?.id;
    if (!assistantID) {
      return null;
    }
    const deadline = Date.now() + REPLY_TIMEOUT;
    while (Date.now() < deadline) {
      if (this.aborted) {
        throw new AgentAbortError("aborted");
      }
      const poll = await manager.client.session.message({
        path: { id: sessionID, messageID: assistantID },
        query: { directory },
      });
      const message = poll.data as ChatMessageEnvelope | null;
      if (!message) {
        return null;
      }
      if (message.info.error) {
        throw new Error(`agente (reply): ${String(message.info.error)}`);
      }
      if (messageText(message).length > 0 || message.info.time?.completed) {
        return { id: assistantID, text: messageText(message) };
      }
      await sleep(POLL_INTERVAL);
    }
    return null;
  }

  private publishReply(reply: ReplyEnvelope): void {
    this.events.publish({
      type: "message.updated",
      properties: { info: { id: reply.id, role: "assistant" } },
    });
    if (reply.text.length > 0) {
      this.events.publish({
        type: "message.part.updated",
        properties: {
          part: { type: "text", messageID: reply.id, text: reply.text },
        },
      });
    }
    this.events.publish({ type: "file.edited", properties: { file: "" } });
  }

  private async session(
    manager: OpenCodeInstance,
    directory: string,
  ): Promise<string> {
    if (this.sessionID && this.directory === directory) {
      return this.sessionID;
    }
    const created = await manager.client.session.create({
      query: { directory },
    });
    if (created.error) {
      throw new Error(`agente (create): ${String(created.error)}`);
    }
    const id = created.data.id;
    this.sessionID = id;
    this.directory = directory;
    return id;
  }

  private resetSession(): void {
    this.sessionID = null;
    this.directory = null;
  }
}