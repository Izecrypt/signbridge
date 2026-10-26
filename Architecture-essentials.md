# SignBridge Architecture Essentials

One-page reference. Full detail in `Architecture.md` and `PRD.md`.

## Key invariants

1. Never send raw video to any API. Only landmarks and text leave the device.
2. Always offer a fingerspelling fallback for out-of-vocabulary signs.
3. ASL only. Other sign languages are roadmap.
4. Never claim interpreter replacement. SignBridge is an accessibility bridge for everyday transactions.
5. No secrets in the repo. API keys live in environment variables; `.env` is gitignored.
6. No datasets in the repo. WLASL, MS-ASL, and SignBank usage must respect their licenses.
7. Scope guard: coffee shop domain, ~150 signs (ordering, size, allergy, price, thanks).

## Module map

- `web/landmarks.js` - webcam capture, MediaPipe landmark pipeline (stub). Direction A entry.
- `api/muse.js` - the only module that calls Muse Spark / Wonder / Image (stub). Functions: `translateGlossToEnglish`, `speak`, `transcribe`, `englishToGloss`.
- `avatar/rig.js` - Three.js avatar rig (stub). Functions: `createAvatarRig`, `planAndPerform`.
- `avatar/dictionary.js` - SignBank dictionary loader (stub). Function: `loadSignDictionary`.
- `data/README.md` - dataset sources and license notes.

## Data formats

- `LandmarkFrame`: timestamp, up to 2 hands of 21 points, optional face mesh.
- `GlossSequence`: ordered ASL gloss strings. Shared format between both pipelines.
- `SignEntry`: gloss, keyframes, optional facial grammar, source attribution.

## Commands

None yet beyond git. No build tool, no dependencies installed. Bundler (Vite) is planned but not set up.

## Current state

Everything is a stub; all functions throw "not implemented". First build task (days 1 to 2): vertical slice, verify Muse API modalities and rate limits, browser landmark pipeline.
