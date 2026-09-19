import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useChat } from "../hooks/useChat";
import { useI18n } from "../hooks/useI18n";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { MarkdownRenderer } from "./renderer/MarkdownRenderer";
import { SendIcon } from "./SendIcon";

interface ChatPanelProps {
  onFilesChanged: () => void;
}

export function ChatPanel({ onFilesChanged }: ChatPanelProps) {
  const { t } = useI18n();
  const { messages, responding, notice, send, abort } = useChat(onFilesChanged);
  const { size, startResize, onResize, endResize } = useResizablePanel(
    () => Math.round(window.innerWidth * 0.3)
  );
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLUListElement>(null);
  const lastMessage = messages[messages.length - 1];
  const showIndicator =
    responding && !(lastMessage?.role === "agent" && lastMessage.content.length > 0);

  useEffect(() => {
    const element = messagesRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, responding]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (content.length === 0) {
      return;
    }
    setDraft("");
    void send(content);
  };

  return (
    <aside className="chat" style={{ width: size }}>
      <div
        className="chat-resizer"
        onPointerDown={startResize}
        onPointerMove={onResize}
        onPointerUp={endResize}
      />
      <ul className="chat-messages" ref={messagesRef}>
        {messages.length === 0 && !responding && (
          <li className="chat-empty">{t("chat.empty")}</li>
        )}
        {messages.map((message) => (
          <li key={message.id} className={`chat-message ${message.role}`}>
            {message.role === "agent" ? (
              <MarkdownRenderer text={message.content} />
            ) : (
              message.content
            )}
          </li>
        ))}
        {showIndicator && (
          <li className="chat-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </li>
        )}
      </ul>
      {notice && <p className="chat-notice">{notice}</p>}
      <form className="chat-form" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("chat.placeholder")}
          rows={3}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="chat-actions">
          {responding && (
            <button type="button" className="chat-stop" onClick={() => void abort()}>
              {t("chat.stop")}
            </button>
          )}
          <button type="submit" disabled={draft.trim().length === 0}>
            <SendIcon />
            {t("chat.send")}
          </button>
        </div>
      </form>
    </aside>
  );
}