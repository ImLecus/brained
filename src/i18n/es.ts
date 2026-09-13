export const es = {
  "app.name": "Brained",
  "settings.title": "Configuración",
  "settings.vault": "Bóveda (raíz)",
  "settings.instructions": "AGENTS.md",
  "settings.model": "Modelo",
  "settings.language": "Idioma",
  "settings.theme": "Tema",
  "settings.save": "Guardar",
  "settings.cancel": "Cancelar",
  "chat.placeholder": "Habla con el agente de tu bóveda…",
  "chat.send": "Enviar",
  "chat.empty": "Empieza a escribir para hablar con el agente.",
} as const;

export type I18nKey = keyof typeof es;