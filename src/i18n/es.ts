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
  "chat.sessionReset": "El agente no respondió; se ha reiniciado su sesión. Reenvía tu mensaje.",
  "chat.error": "El agente no respondió. Revisa tu conexión e inténtalo de nuevo.",
  "node.loading": "Cargando el archivo…",
  "node.empty": "El archivo no tiene contenido.",
  "node.close": "Cerrar",
} as const;

export type I18nKey = keyof typeof es;