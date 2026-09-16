import { useState } from "react";
import type { FormEvent } from "react";
import type { AppConfig, Language, Theme } from "../../shared/types";
import { useConfig } from "../context/ConfigContext";
import { useI18n } from "../hooks/useI18n";

interface SettingsPanelProps {
  onClose: () => void;
}

function defaultConfig(): AppConfig {
  return {
    model: "opencode/big-pickle",
    language: "es",
    theme: "light",
  };
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { config, update } = useConfig();
  const { t } = useI18n();
  const [draft, setDraft] = useState<AppConfig>(config ?? defaultConfig());

  if (!config) {
    return null;
  }

  const setField = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void update(draft).then(onClose);
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <form
        className="settings"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{t("settings.title")}</h2>
        <label className="settings-field">
          <span>{t("settings.model")}</span>
          <input
            type="text"
            value={draft.model}
            onChange={(event) => setField("model", event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>{t("settings.language")}</span>
          <select
            value={draft.language}
            onChange={(event) => setField("language", event.target.value as Language)}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="settings-field">
          <span>{t("settings.theme")}</span>
          <select
            value={draft.theme}
            onChange={(event) => setField("theme", event.target.value as Theme)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div className="settings-actions">
          <button type="button" onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="submit">{t("settings.save")}</button>
        </div>
      </form>
    </div>
  );
}