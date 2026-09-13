# AGENTS.md — Brained

Guía de trabajo para construir **Brained**, un POC de "segundo cerebro" con
vista de grafo force-directed y agente conversacional (Opencode) sobre una
bóveda de archivos Markdown.

## Reglas no negociables

- **NUNCA** añadir comentarios al código (ni explicativos, ni `TODO`, ni JSDoc).
- Seguir buenas prácticas de programación: código limpio, tipado estricto,
  nombres descriptivos, componentes pequeños y funciones puras.
- El código debe entenderse solo; si una sección requiere explicación, la
  lógica debe extraerse o renombrarse mejor.
- No introducir librerías de UI (nada de MUI/Tailwind). CSS propio.
- No subir la especificación ni nada de `.private/` al repositorio (ya está en
  `.gitignore`).

## Visión

- **Elemento principal**: vista de grafo (tipo Obsidian) con fuerzas de
  atracción/repulsión (_force-directed_) construidas desde los enlaces de la
  bóveda.
- **Panel derecho**: chat que llama internamente a **Opencode**.
- **Flujo interno idéntico al uso actual**: el agente lee el `AGENTS.md`
  elegido y modifica/crea archivos `.md` de la bóveda.
- **Minimalismo extremo**: grafo monocromo a negro puro sobre fondo blanco, o
  blanco puro sobre fondo negro. Chat con mucho espacio en blanco. Sin colores
  extra ni otras formas.
- **Fondo de la app**: gradiente ligero de blanco a gris claro (claro) o de
  negro a gris oscuro (oscuro).
- **Configuración de la app**: elegir el `AGENTS.md` (ruta/archivo de
  instrucciones) y el modelo que usa el agente.
- **Idioma**: español o inglés, cambiable desde configuración.
- **App 100 % local** (localhost, sin nube).

## Stack

TypeScript de punta a punta.

### Frontend

- React + Vite en TypeScript.
- `react-force-graph` (envuelve `d3-force`) para el grafo en canvas: carga =
  repulsión, enlace = atracción, con zoom/pan. Nodos monocromo sobre el fondo.
- CSS propio, sin librería de UI.
- i18n mínimo: función `t()` propia o i18next con ES/EN.
- Todos los estilos de componentes comunes, así como los colores de la aplicación, deben ir en su PROPIO ARCHIVO .css, para poder ser reutilizados en otros proyectos.

### Backend (Node + TypeScript)

- Servidor ligero con **Fastify**: parsea la bóveda, sirve el grafo y orquesta
  el agente.
- Parseo de la bóveda: glob de `*.md` + regex para extraer `[[wikilinks]]` →
  JSON de nodos y enlaces.
- Integración con **Opencode** vía `@opencode-ai/sdk`:
  - `createOpencode({ config: { model: ... } })` levanta el server embebido.
  - `client.session.create` + `session.prompt` con el modelo elegido.
  - `event.subscribe()` (SSE) para streamear la respuesta y refrescar el grafo
    cuando el agente edita archivos.
  - El `AGENTS.md` se toma de la raíz/bóveda elegida en configuración.

### Configuración

- `config.json` de la app: ruta del `AGENTS.md` (raíz de la bóveda), modelo,
  idioma, tema (claro/oscuro).

## Estructura sugerida

```
.
├── server/          # Backend Fastify + parseo de bóveda + integración Opencode
├── src/             # Frontend React/Vite
│   ├── components/  # GraphView, ChatPanel, SettingsPanel, ...
│   ├── i18n/        # ES/EN
│   └── ...
└── config.json      # Ajustes de la app
```

## Punto de corte del POC

1. Parseo de la bóveda (nodos + enlaces desde `[[wikilinks]]`).
2. Grafo force-directed navegable (zoom/pan, monocromo).
3. Chat que responde vía Opencode y edita la bóveda (SSE + refresco del grafo).
4. Config: `AGENTS.md`, modelo, idioma, tema.

## Definición de completado

- El código compila sin errores de TypeScript.
- Sin comentarios en ningún archivo de código.
- Sin dependencias de UI externas.
- El grafo renderiza nodos/enlaces de la bóveda real con zoom/pan y estética
  monocroma.
- El chat responde por Opencode con el modelo configurado y refleja en el grafo
  los cambios que hace en los `.md`.
- La app funciona al 100 % en local.
