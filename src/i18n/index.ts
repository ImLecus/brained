import type { Language } from "../../shared/types";
import { en } from "./en";
import { es } from "./es";
import type { I18nKey } from "./es";

export function translate(language: Language, key: I18nKey): string {
  return (language === "en" ? en : es)[key];
}