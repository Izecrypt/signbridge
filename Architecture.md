# SignBridge Architecture

Status: draft, created with the initial scaffold. Grounded in `PRD.md`; where the PRD is silent this file says so rather than inventing design.

## Overview

Two-way sign language translator (ASL) for the Meta Global AI Developer Hackathon, indie track. Browser-based, one domain (coffee shop, ~150 signs). Two pipelines share one web app, one Muse API client, and one avatar module.

## Direction A: Sign to Voice

Flow:

1. Webcam capture in the browser (`web/landmarks.js`).
2. MediaPipe hand and face landmarks, computed on-device.
3. SAM 3.1 signer isolation and hand crops.
4. Temporal model (TCN or transformer) trained on WLASL / MS-ASL, producing a sign gloss sequence.
5. Muse Spark rewrites the gloss sequence into fluent English.
6. Muse Wonder text-to-speech, spoken aloud.

Privacy boundary: raw video never leaves the device. Only structured landmarks and motion descriptions cross to any API. Out-of-vocabulary signs fall back to fingerspelling.

## Direction B: Voice to Sign

Flow:

1. Microphone capture in the browser.
2. Muse Wonder speech-to-text.
3. Muse Spark translates English to ASL gloss, including topic-comment reorder (for example, "PIZZA YOU WANT WHICH?").
4. The Three.js avatar (`avatar/rig.js`) performs dictionary-based signs (`avatar/dictionary.js`, SignBank data) with motion interpolation and facial grammar.

Generative video is not used for hand articulation. Muse Image is only for avatar appearance and branding.

## Data models

- `LandmarkFrame` (`web/landmarks.js`): timestamp, up to 2 hands of 21 landmark points each, optional face mesh points. This is the only Direction A payload that may leave the device.
- `GlossSequence`: ordered list of ASL gloss strings, produced by the temporal model (Direction A) or by Muse Spark (Direction B). Shared boundary format between pipelines.
- `SignEntry` (`avatar/dictionary.js`): gloss label, ordered keyframes for the rig, optional facial grammar markers, source attribution.

## Tech stack

- Browser app: plain ES modules for now; bundler not chosen yet (Vite is the plan). No dependencies installed.
- Landmarks: MediaPipe Tasks Vision (HandLandmarker, FaceLandmarker), on-device.
- Signer isolation: SAM 3.1 (planned).
- Temporal model: TCN or transformer, trained on WLASL / MS-ASL (not started).
- Avatar: Three.js, glTF rigged model (not started).
- API client: `api/muse.js`, the single module allowed to call Muse Spark / Wonder / Image.

## Integration boundaries

- `web/landmarks.js` owns capture and landmark extraction; it calls only `api/muse.js` for anything remote.
- `api/muse.js` is the only module that holds API logic and reads `MUSE_API_KEY`. No other module may call external APIs.
- `avatar/dictionary.js` owns sign data loading; `avatar/rig.js` owns rendering and performance. The gloss planner (not yet written) sits between Muse Spark output and the rig.

## Security and privacy

- No biometric video leaves the device; only landmarks and text.
- No secrets in the repo. `MUSE_API_KEY` and `MUSE_BASE_URL` come from environment variables; `.env` is gitignored.
- Datasets (WLASL, MS-ASL, SignBank) are not committed; usage must respect their licenses (see `data/README.md`).

## Reliability and open questions

- Muse endpoint paths, modalities, and rate limits are unconfirmed; `api/muse.js` is a stub until verified (days 1 to 2 of the build plan).
- Continuous sign recognition is an open research problem; recognition accuracy is the weakest number. Mitigation: constrained domain and fingerspelling fallback.
- Demo requires a recorded fallback in case live two-way latency fails on stage.
- Deaf tester feedback during build week is a requirement, not a nice-to-have.
