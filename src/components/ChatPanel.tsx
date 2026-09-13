import { useState } from "react";
import type { FormEvent } from "react";
import { useChat } from "../hooks/useChat";
import { useI18n } from "../hooks/useI18n";

interface ChatPanelProps {
  onFilesChanged: () => void;
}

export function ChatPanel({ onFilesChanged }: ChatPanelProps) {
  const { t } = useI18n();
  const { messages, responding, send } = useChat(onFilesChanged);
  const [draft, setDraft] = useState("");
  const lastMessage = messages[messages.length - 1];
  const showIndicator =
    responding && !(lastMessage?.role === "agent" && lastMessage.content.length > 0);

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
    <aside className="chat">
      <ul className="chat-messages">
        {messages.length === 0 && !responding && (
          <li className="chat-empty">{t("chat.empty")}</li>
        )}
        {messages.map((message) => (
          <li key={message.id} className={`chat-message ${message.role}`}>
            {message.content}
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
        <button type="submit" disabled={responding || draft.trim().length === 0}>
          {t("chat.send")}
        </button>
      </form>
    </aside>
  );
}