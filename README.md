# SignBridge

Two-way sign language translator (ASL) for the Meta Global AI Developer Hackathon, indie track.

Roughly 70M Deaf people use a sign language as their primary language, and ASL is not English (own grammar, topic-comment order, spatial referencing). SignBridge bridges both directions of a conversation in a constrained domain (a coffee shop, about 150 signs), as an accessibility tool for everyday transactions, not an interpreter replacement.

## Direction A: Sign to Voice

```
webcam -> MediaPipe landmarks (on-device) -> temporal model
  -> sign gloss -> Muse Spark: gloss to English -> browser speechSynthesis
```

Raw video never leaves the device. Only structured landmarks and motion descriptions go to the API. Fingerspelling covers out-of-vocabulary signs.

## Design notes (updated from the original concept)

- There is no hosted text-to-speech in the Meta Model API, so spoken output uses the browser's built-in speechSynthesis (on-device, free). `muse-wonder-1.0` is expensive ($4 in / $20 out per 1M tokens) and stays off the demo loop.
- Speech-to-text for Direction B will use `muse-voice-transcribe-1.0` (POST /v1/asr/transcribe), not Wonder.
- SAM 3.1 signer isolation is not needed: MediaPipe landmarks are the input path and stay that way.

## Direction B: Voice to Sign

```
microphone -> Muse Voice Transcribe STT -> Muse Spark: English to ASL gloss
  -> Three.js avatar performs dictionary signs (SignBank)
```

The rigged avatar performs signs with motion interpolation and facial grammar. Generative video cannot do accurate hand articulation, so it is used only for avatar appearance and branding.

## Quickstart

The sign-to-voice slice runs with no build step. From the repository root:

```
python3 -m http.server 8080
```

Open http://localhost:8080/web/, allow the camera, and press Start. Paste your Meta Model API key into the session-only field, tick "Live translate (Muse)", and sign. See `web/README.md` for the full manual verification checklist.

## Repository layout

- `web/` - browser app: webcam capture and the MediaPipe landmark pipeline module
- `avatar/` - Three.js avatar rig placeholder and sign dictionary loader stub
- `api/` - the only module that calls model APIs (muse-spark-1.3 for recognition and translation; no keys in the repo)
- `data/` - notes on WLASL, MS-ASL, and SignBank sources and licenses (no datasets committed)

## Hackathon attribution

Built for the Meta Global AI Developer Hackathon, indie track. Approved 2026-10-26, build window ends Nov 4, 2026.

## License

MIT. Copyright Ize, 2026. See `LICENSE`.
