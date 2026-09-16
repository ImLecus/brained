import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { BrainInfo } from "../../shared/types";
import { listBrains } from "../api/client";
import { useI18n } from "../hooks/useI18n";
import type { I18nKey } from "../i18n/es";

interface BrainLoaderProps {
  onCreate: (name: string, password: string) => Promise<void>;
  onOpen: (path: string, password: string) => Promise<void>;
}

interface FormError {
  code?: string;
  message?: string;
}

function errorText(
  code: string | undefined,
  message: string | undefined,
  t: (key: I18nKey) => string,
): string {
  switch (code) {
    case "invalid_password":
      return t("brain.error.invalidPassword");
    case "invalid_file":
      return t("brain.error.invalidFile");
    case "exists":
      return t("brain.error.exists");
    case "invalid_name":
      return t("brain.error.invalidName");
    case "missing_fields":
      return t("brain.error.missingFields");
    default:
      return message ?? t("brain.error.generic");
  }
}

export function BrainLoader({ onCreate, onOpen }: BrainLoaderProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"create" | "open">("create");
  const [brains, setBrains] = useState<BrainInfo[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listBrains()
      .then((found) => {
        if (!active) {
          return;
        }
        setBrains(found);
        if (found.length > 0) {
          setMode("open");
          setSelected(found[0].path);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const openMode = mode === "open";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!password || (openMode && !selected) || (!openMode && !name.trim())) {
      setError(errorText("missing_fields", undefined, t));
      return;
    }
    if (!openMode && password !== confirm) {
      setError(errorText("mismatch", undefined, t));
      return;
    }
    setBusy(true);
    const attempt = openMode ? onOpen(selected, password) : onCreate(name.trim(), password);
    void attempt.catch((failure: FormError) => {
      setError(errorText(failure.code, failure.message, t));
      setBusy(false);
    });
  };

  return (
    <div className="brain-backdrop">
      <form className="brain-card" onSubmit={submit}>
        <h1 className="brain-heading">{t("app.name")}</h1>
        <p className="brain-subtitle">{t("brain.welcome")}</p>
        <div className="brain-tabs">
          <button
            type="button"
            className={openMode ? "" : "active"}
            onClick={() => setMode("create")}
          >
            {t("brain.tab.create")}
          </button>
          <button
            type="button"
            className={openMode ? "active" : ""}
            onClick={() => setMode("open")}
          >
            {t("brain.tab.open")}
          </button>
        </div>
        {openMode ? (
          brains.length === 0 ? (
            <p className="brain-empty">{t("brain.noBrains")}</p>
          ) : (
            <label className="brain-field">
              <span>{t("brain.pickBrain")}</span>
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {brains.map((brain) => (
                  <option key={brain.path} value={brain.path}>
                    {brain.name}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : (
          <label className="brain-field">
            <span>{t("brain.name")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("brain.namePlaceholder")}
              autoFocus
            />
          </label>
        )}
        <label className="brain-field">
          <span>{t("brain.password")}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("brain.passwordPlaceholder")}
          />
        </label>
        {!openMode && (
          <label className="brain-field">
            <span>{t("brain.passwordConfirm")}</span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={t("brain.passwordPlaceholder")}
            />
          </label>
        )}
        {error && <p className="brain-error">{error}</p>}
        <button
          className="brain-submit"
          type="submit"
          disabled={busy || (openMode && brains.length === 0)}
        >
          {busy ? t("brain.busy") : openMode ? t("brain.submitOpen") : t("brain.submitCreate")}
        </button>
      </form>
    </div>
  );
}