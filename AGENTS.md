# AGENTS.md

## Project

Desktop GUI app (JS) that fetches all Chaoxing (超星学习通) homework and provides native OS desktop notifications 24 hours and 1 hour before homework due dates. The reverse-engineered API is documented in `API.md`.

## Direction

- **Packaging**: Prefer Rust-based packaging via Tauri (Rust backend + JS frontend).
- **Session scope**: Each session focuses on a single module only.

## Project Initialization

- **TDD**: Write tests first for every feature. No tests exist yet — if the project is empty, initialize the project and set up the build, test, lint, and GUI frameworks. If files already exist, skip initialization and implement the next feature.
- **Framework selection**: Prefer Tauri (Rust) for packaging; document any alternative if chosen.

## Architecture Rules

- **Primary specification**: `API.md`. All implementation code should build against this spec and be added at the repo root.
- **Code conventions**: The `karpathy-guidelines` skill (`.opencode/skills/karpathy-guidelines/`) is loaded and should be referenced when writing/refactoring code.
- **`.opencode/.gitignore`** ignores `node_modules`, `package.json`, `package-lock.json`, `bun.lock` — these are workspace-internal files, not repo-level config. Keep userland code at the repo root.
- **Single commit, single branch (`main`), no remote** configured.

## Implementation Details (Authentication & API)

- **Recommended homework endpoint**: `/work/stu-work` (cookie-only, no enc tokens). The newer `/mooc2/work/list` requires course-specific `enc` tokens which are hard to obtain programmatically. See `API.md §3.1`.
- **Login**: AES-128-CBC with key `u2oh6Vu^HWe4_AES` (same for IV), PKCS7, Base64 output. Both phone AND password are encrypted.
- **Authentication handling**: If the user provides invalid credentials or the `/work/stu-work` endpoint returns an authentication error, the UI must prompt the user to re-enter their phone and password.

Your current task is to act as the first agent: evaluate the workspace, select the JS build and GUI frameworks, initialize the codebase at the repo root if needed, and write the first failing test for the Login function.
