import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../api/client";
import type { ChatMessage } from "../../shared/types";
import type { I18nKey } from "../i18n";

interface TextPart {
  messageID: string;
  text: string;
  replace: boolean;
}

interface MessageInfo {
  id: string;
  role: string;
}

function extractText(event: unknown): TextPart | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const value = event as {
    type?: string;
    properties?: {
      messageID?: string;
      field?: string;
      delta?: string;
      part?: { type?: string; text?: string; messageID?: string };
    };
  };
  const properties = value.properties;
  if (!properties) {
    return null;
  }
  if (value.type === "message.part.delta") {
    if (
      properties.field !== "text" ||
      typeof properties.messageID !== "string" ||
      typeof properties.delta !== "string"
    ) {
      return null;
    }
    return { messageID: properties.messageID, text: properties.delta, replace: false };
  }
  if (value.type === "message.part.updated") {
    const part = properties.part;
    if (
      part?.type !== "text" ||
      typeof part.messageID !== "string" ||
      typeof part.text !== "string"
    ) {
      return null;
    }
    return { messageID: part.messageID, text: part.text, replace: true };
  }
  return null;
}

function messageRole(event: unknown): MessageInfo | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const value = event as {
    type?: string;
    properties?: { info?: { id?: string; role?: string } };
  };
  if (value.type !== "message.updated") {
    return null;
  }
  const info = value.properties?.info;
  if (typeof info?.id !== "string" || typeof info.role !== "string") {
    return null;
  }
  return { id: info.id, role: info.role };
}

function isFileChange(event: unknown): boolean {
  if (!event || typeof event !== "object") {
    return false;
  }
  const type = (event as { type?: string }).type;
  return type === "file.edited" || type === "file.watcher.updated";
}

export function useChat(onFilesChanged: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [responding, setResponding] = useState(false);
  const [notice, setNotice] = useState<I18nKey | null>(null);
  const parts = useRef(new Map<string, string>());
  const roles = useRef(new Map<string, string>());
  const sentTexts = useRef(new Set<string>());
  const pendingParts = useRef(new Map<string, string>());
  const flushRaf = useRef(0);
  const onFilesChangedRef = useRef(onFilesChanged);
  onFilesChangedRef.current = onFilesChanged;

  const enqueue = (messageID: string, content: string) => {
    if (content.length === 0) {
      return;
    }
    pendingParts.current.set(messageID, content);
    if (flushRaf.current === 0) {
      flushRaf.current = requestAnimationFrame(() => {
        flushRaf.current = 0;
        const updates = pendingParts.current;
        pendingParts.current = new Map();
        if (updates.size === 0) {
          return;
        }
        setMessages((current) => {
          const next = [...current];
          for (const [messageID, content] of updates) {
            const index = next.findIndex((item) => item.id === messageID);
            if (index >= 0) {
              next[index] = { ...next[index], content };
            } else {
              next.push({ id: messageID, role: "agent", content });
            }
          }
          return next;
        });
      });
    }
  };

  useEffect(() => {
    const source = new EventSource("/api/chat/events");
    source.onmessage = (message) => {
      let event: unknown;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      const role = messageRole(event);
      if (role) {
        roles.current.set(role.id, role.role);
        return;
      }
      const part = extractText(event);
      if (part) {
        const { messageID, text, replace } = part;
        const accumulated = replace
          ? text
          : (parts.current.get(messageID) ?? "") + text;
        if (roles.current.get(messageID) === "user" || sentTexts.current.has(accumulated)) {
          return;
        }
        parts.current.set(messageID, accumulated);
        enqueue(messageID, accumulated);
        return;
      }
      if (isFileChange(event)) {
        onFilesChangedRef.current();
      }
    };
    return () => {
      source.close();
      if (flushRaf.current !== 0) {
        cancelAnimationFrame(flushRaf.current);
        flushRaf.current = 0;
      }
    };
  }, []);

  const send = async (text: string): Promise<void> => {
    const content = text.trim();
    if (content.length === 0 || responding) {
      return;
    }
    setNotice(null);
    sentTexts.current.add(content);
    parts.current.clear();
    roles.current.clear();
    pendingParts.current.clear();
    if (flushRaf.current !== 0) {
      cancelAnimationFrame(flushRaf.current);
      flushRaf.current = 0;
    }
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
    setResponding(true);
    try {
      await sendMessage(content);
    } catch (error) {
      const code = (error as { code?: string }).code;
      setNotice(code === "session_reset" ? "chat.sessionReset" : "chat.error");
    } finally {
      setResponding(false);
    }
  };

  return { messages, responding, notice, send };
}