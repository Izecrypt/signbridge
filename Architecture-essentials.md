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

- `web/landmarks.js` - webcam capture, MediaPipe hand + pose landmark pipeline (working, no build step). Direction A entry.
- `api/muse.js` - the only module that calls model APIs (muse-spark-1.3). Functions: `glossFromLandmarks`, `glossToEnglish`, `speakEnglish` (browser voice, on-device). `transcribe`, `englishToGloss` are Direction B stubs.
- `avatar/rig.js` - Three.js avatar rig (stub). Functions: `createAvatarRig`, `planAndPerform`.
- `avatar/dictionary.js` - SignBank dictionary loader (stub). Function: `loadSignDictionary`.
- `data/README.md` - dataset sources and license notes.

## Data formats

- `LandmarkFrame`: timestamp, up to 2 hands of 21 points, optional face mesh.
- `GlossSequence`: ordered ASL gloss strings. Shared format between both pipelines.
- `SignEntry`: gloss, keyframes, optional facial grammar, source attribution.

## Commands

No build step. Run logic tests with `node --experimental-default-type=module --test web/spelling.test.js api/muse.test.js`. Serve locally with `python3 -m http.server 8080 --bind 127.0.0.1`; open `http://127.0.0.1:8080/web/`.

## Current state

The local prototype path is implemented: webcam -> MediaPipe hand landmarks (optional upper-body pose) -> 1.5-second windows -> compact geometric text description -> Muse Spark candidate gloss or single-letter fingerspelling -> spelling buffer / English phrase -> browser speech. No trained temporal sign model, SAM signer isolation, 150-sign dictionary, or voice-to-sign avatar is implemented. Recognition accuracy and live Muse behavior still require an owner-run, camera-in-frame session with a valid session-only API key. Base URL: https://api.meta.ai/v1; model: muse-spark-1.3; speech uses browser speechSynthesis. This is a hackathon prototype, not a production-validated translator.
