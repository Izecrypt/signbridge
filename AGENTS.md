# SignBridge AGENTS.md

Project-specific instructions for AI agents working in this repository. Read `Architecture-essentials.md` first, `Architecture.md` and `PRD.md` as needed.

## Verification expectations

- No build or test commands exist yet. Verification is: the requested artifact exists, prose and code follow the style rules below, and git state is clean and pushed.
- Once code is implemented, verify by running the real pipeline paths (webcam landmark extraction, Muse calls with a valid local env, avatar playback), not just imports.

## Hard rules

- No secrets in the repo, ever. API keys come from environment variables (`MUSE_API_KEY`, `MUSE_BASE_URL`); `.env` is gitignored and must never be committed.
- No em dashes or en dashes in any prose. Use commas, periods, parentheses, or "to".
- No datasets in the repo. WLASL, MS-ASL, and SignBank usage must respect their licenses; record confirmed terms in `data/README.md` before using data.
- Never weaken the privacy stance: raw video never leaves the device, only landmarks and text.

## Product constraints agents must respect

- Scope guard: coffee shop domain, ~150 signs. Do not expand the domain without an explicit owner decision.
- ASL only. Do not add other sign languages.
- Never claim interpreter replacement in any copy or code comment. Position: accessibility bridge for everyday transactions.
- Fingerspelling fallback for out-of-vocabulary signs is a required feature, not optional.
- Deaf community trust is core. Deaf tester feedback during build week is a requirement; show real feedback in the demo video.
- The demo needs a recorded fallback alongside the live path.

## Working conventions

- All remote API calls go through `api/muse.js`. Do not call external APIs from other modules.
- Match the existing plain-ES-module style until a bundler is chosen.
- When implementing a stub, remove its TODO and update the module README.
- Keep `Architecture-essentials.md` in sync when invariants, module map, or commands change.
