# AGENTS.md

## Fast start (use npm)
- Install deps: `npm i` (runs `postinstall` -> `npm run rebuild:native` for `better-sqlite3`).
- Web-only dev: `npm run dev`.
- Electron + renderer dev: `npm run electron:dev` (starts Vite and waits for `http://localhost:5173` before launching Electron).
- Desktop production smoke test: run `npm run build` **before** `npm run electron:start` (Electron loads `dist/index.html` when no dev server URL is set).
- If Electron/Node versions change and native bindings break, run `npm run rebuild:native`.

## Verification reality
- There are currently no repo scripts for lint, tests, or typecheck.
- The only built-in automated verification is `npm run build`.

## Project wiring (important boundaries)
- Renderer app: `src/main.tsx` -> `src/app/App.tsx`.
- Electron main process: `electron/main.js`.
- Preload bridge: `electron/preload.js` exposes `window.electronAPI`.
- IPC handlers live in `electron/handlers/index.js` (currently only `app:ping` and `db:ping`).
- SQLite is initialized in `electron/db/index.js` at `${app.getPath('userData')}/pos.sqlite3`.

## Data model gotcha
- Most UI data is still in in-memory module stores under `src/app/components/data/` (`products.ts`, `customers.ts`, `suppliers.ts`).
- CRUD in those files mutates module-scoped arrays + notifies subscribers; changes are session-local and not persisted to SQLite.

## Toolchain quirks to preserve
- Keep both `react()` and `tailwindcss()` plugins in `vite.config.ts` (repo comment marks both as required).
- Tailwind v4 is configured via CSS (`src/styles/tailwind.css` with `@source`), so no `tailwind.config.*` file exists.
- `vite.config.ts` contains a custom `figma:asset/*` resolver to `src/assets/*`; removing it can break asset imports.

## Build artifacts
- `dist/` is generated output consumed by Electron for non-dev runs; do not hand-edit it.
