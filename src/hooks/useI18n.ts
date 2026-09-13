import { useMemo } from "react";
import type { I18nKey } from "../i18n/es";
import { translate } from "../i18n";
import { useConfig } from "../context/ConfigContext";

export function useI18n() {
  const { config } = useConfig();
  const language = config?.language ?? "es";
  const t = useMemo(() => (key: I18nKey) => translate(language, key), [language]);
  return { t };
}