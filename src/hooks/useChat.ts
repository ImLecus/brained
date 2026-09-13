import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../shared/types";
import { sendMessage } from "../api/client";

interface TextPart {
  messageID: string;
  text: string;
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
      part?: { type?: string; text?: string; messageID?: string };
      delta?: string;
    };
  };
  if (value.type !== "message.part.updated") {
    return null;
  }
  const part = value.properties?.part;
  if (part?.type !== "text") {
    return null;
  }
  const text = typeof value.properties?.delta === "string" ? value.properties.delta : part.text;
  if (typeof text !== "string" || typeof part?.messageID !== "string") {
    return null;
  }
  return { messageID: part.messageID, text };
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
  return !!event && typeof event === "object" && (event as { type?: string }).type === "file.watcher.updated";
}

export function useChat(onFilesChanged: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [responding, setResponding] = useState(false);
  const parts = useRef(new Map<string, string>());
  const roles = useRef(new Map<string, string>());
  const sentTexts = useRef(new Set<string>());
  const onFilesChangedRef = useRef(onFilesChanged);
  onFilesChangedRef.current = onFilesChanged;

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
        const { messageID, text } = part;
        const accumulated = (parts.current.get(messageID) ?? "") + text;
        if (roles.current.get(messageID) === "user" || sentTexts.current.has(accumulated)) {
          return;
        }
        parts.current.set(messageID, accumulated);
        setMessages((current) => {
          const index = current.findIndex((item) => item.id === messageID);
          if (index >= 0) {
            const next = [...current];
            next[index] = { ...next[index], content: accumulated };
            return next;
          }
          return [...current, { id: messageID, role: "agent", content: accumulated }];
        });
        return;
      }
      if (isFileChange(event)) {
        onFilesChangedRef.current();
      }
    };
    return () => {
      source.close();
    };
  }, []);

  const send = async (text: string): Promise<void> => {
    const content = text.trim();
    if (content.length === 0 || responding) {
      return;
    }
    sentTexts.current.add(content);
    parts.current.clear();
    roles.current.clear();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
    setResponding(true);
    try {
      await sendMessage(content);
    } finally {
      setResponding(false);
    }
  };

  return { messages, responding, send };
}