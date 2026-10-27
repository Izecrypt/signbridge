# api/

The only module allowed to call model APIs.

- `muse.js` - browser module, plain fetch, no build step. Talks to the Meta Model API (OpenAI-compatible, base URL `https://api.meta.ai/v1`, POST /chat/completions).
  - `glossFromLandmarks(frames, { apiKey, model })` - describes a window of landmark frames on-device and asks muse-spark-1.3 for one coffee-shop gloss word or `FINGERSPELL:<letters>`.
  - `glossToEnglish(gloss, { apiKey, model })` - one short natural English sentence from a gloss.
  - `speakEnglish(text)` - browser speechSynthesis, on-device, free. There is no hosted TTS.
  - `describeWindow(frames)` - the on-device text description builder (exported for testing).
  - `transcribe` / `englishToGloss` - Direction B stubs, not implemented.
- The key is passed in per call by the page (session-only field or `window.SIGNBRIDGE_API_KEY`). Never committed, never logged.
- Requests: 10s timeout, temperature 0, small max_tokens, `MuseError` with kinds for clean UI mapping.

TODO (Direction B): `transcribe` via muse-voice-transcribe-1.0 (POST /v1/asr/transcribe), `englishToGloss` via muse-spark-1.3.
