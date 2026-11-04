# SignBridge, sign-to-voice prototype

SignBridge is an experimental ASL sign-to-voice prototype for low-stakes coffee-shop interactions. Recognition may be wrong. The current build is not a general ASL translator, and its recognition accuracy has not been independently validated.

## Direction A: Sign to Voice

```
webcam -> MediaPipe hand landmarks (on-device) -> 1.5-second windows
  -> compact geometric description -> Muse Spark candidate gloss or letter
  -> spelling buffer / short English output -> browser speechSynthesis
```

Raw video never leaves the device. Only a compact text description derived from landmarks is sent to Meta when Live translate is enabled. The current recognition vocabulary has 40 entries, with a single-letter fingerspelling path. There is no trained temporal sign model.

Use this prototype only for low-stakes demonstration. Do not rely on it for urgent, safety-critical, medical, legal, or other high-consequence communication.

## Design notes (updated from the original concept)

- Spoken output uses the browser's built-in speechSynthesis on-device.
- Speech-to-text for Direction B will use `muse-voice-transcribe-1.0` (POST /v1/asr/transcribe), not Wonder.
- SAM 3.1 signer isolation is not part of this prototype.

## Not implemented

```
microphone -> Muse Voice Transcribe STT -> Muse Spark: English to ASL gloss
  -> Three.js avatar performs dictionary signs (SignBank)
```

Voice-to-sign, the avatar, SAM signer isolation, a trained temporal recognition model, and a curated 150-sign dictionary are not in this build. The planned voice-to-sign architecture is documented in Architecture.md; its modules remain stubs.

## Checks

Run the dependency-free unit checks with Node.js:

```sh
node --experimental-default-type=module --test web/spelling.test.js api/muse.test.js
```

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
