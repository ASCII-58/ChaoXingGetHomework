# AGENTS.md

## Project

Desktop GUI app (Tauri + vanilla JS) that fetches Chaoxing (超星学习通) homework and provides native OS desktop notifications before due dates. The reverse-engineered API is documented in `API.md`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Vite production build → `dist/` |
| `npm test` | Run all vitest tests (node environment) |
| `npm run lint` | ESLint (flat config) |
| `npm run tauri` | Tauri dev window (launches Vite + desktop app) |
| `npm run tauri:build` | Tauri production bundle |

Run a single test file: `npx vitest run tests/login.test.js`

## Architecture

- **Rust backend** (`src-tauri/src/main.rs`): All HTTP calls to Chaoxing happen here via `reqwest`. Tauri commands: `login_with_password`, `fetch_course_list`, `fetch_homework_list`, `check_session`, `resolve_task_url`, plus config/data persistence.
- **JS frontend** (`src/`): Vanilla JS (no framework). Hash-based SPA routing (`src/router.js`). Calls Tauri backend through `src/tauri-login.js` — a thin wrapper around `@tauri-apps/api/invoke` that rejects with an error in browser environments.
- **Login crypto exists in two places**: `src/login.js` (JS, for unit testing) and `src-tauri/src/main.rs` (Rust, for production). Both implement the same AES-128-CBC encryption with key `u2oh6Vu^HWe4_AES`. The Rust version is the authoritative one; the JS copy exists only so login tests don't need Tauri.
- **Frontend files TOUCHED BY REQUIREMENTS**: `index.html`, `src/style.css`, `src/main.js`. Files explicitly **NOT** to modify: `src/tauri-login.js`, `src/router.js`, `src/homework.js`, `tests/`, Rust backend. See `REQUIREMENTS.md` for the current frontend rewrite spec.
- **Config storage**: Rust persists to `dirs::data_dir()/xxt/config.json` and `data.json`. The JS `appState` mirrors this on startup via `loadConfig()`/`loadData()`.

## Conventions

- **TDD**: Write failing tests first, then implement.
- **Session scope**: One module per session. Don't roam across unrelated areas.
- **Primary spec**: `API.md` — all Chaoxing API logic must conform to it.
- **Code style**: Follow the karpathy-guidelines skill (`.opencode/skills/karpathy-guidelines/`).
- **Git**: Single commit, single branch (`main`), no remote configured.
- **`.opencode/`**: OpenCode workspace internals. `node_modules`, `package.json`, `package-lock.json`, `bun.lock` inside `.opencode/` are workspace-internal, not repo-level config.

## API Quirks

- **Homework endpoint**: Use `/work/stu-work` (cookie-only). The newer `/mooc2/work/list` requires course-specific `enc` tokens that are hard to get programmatically. See `API.md §3.1`.
- **Course page redirect**: `/visit/stucoursemiddle?courseid=X&clazzid=Y&cpi=Z&ismooc2=1&v=2` — generates `enc` server-side via 302 redirect. No `enc` needed up front. See `API.md §2.4`.
- **Login**: AES-128-CBC, key+IV both `u2oh6Vu^HWe4_AES`, PKCS7, Base64. Both phone AND password are encrypted.
- **Auth errors**: If credentials are wrong or `/work/stu-work` returns a login redirect, the UI must prompt the user to re-enter phone + password.
