import type { I18nKey } from "./es";

export const en: Record<I18nKey, string> = {
  "app.name": "Brained",
  "settings.title": "Settings",
  "settings.model": "Model",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "settings.save": "Save",
  "settings.cancel": "Cancel",
  "chat.placeholder": "Talk to your vault's agent…",
  "chat.send": "Send",
  "chat.stop": "Stop",
  "chat.empty": "Start typing to talk to the agent.",
  "chat.sessionReset": "The agent did not respond; its session was reset. Resend your message.",
  "chat.promptTimeout": "The agent took too long to reply and its session was reset. Resend your message.",
  "chat.aborted": "Response interrupted.",
  "chat.abortFailed": "Could not interrupt the agent.",
  "chat.error": "The agent failed. Check the configured model and your connection, then try again.",
  "node.loading": "Loading content…",
  "node.empty": "This file has no content.",
  "node.close": "Close",
};