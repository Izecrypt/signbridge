# web/

Browser app for SignBridge. Plain HTML + ES modules, no build step. MediaPipe Tasks Vision loads from the jsDelivr CDN at runtime; model files load from MediaPipe model storage.

- `index.html` - demo page: webcam preview, landmark overlay, liveness indicator, conversation panel, API key field, Live translate toggle.
- `app.js` - page bootstrap: camera start/stop, overlay drawing, landmark queue, status line. With Live translate on, it drains the queue in 2 second windows (at most one Muse request in flight, windows dropped while busy) and runs the slice: `glossFromLandmarks` -> `glossToEnglish` -> `speakEnglish`.
- `landmarks.js` - the landmark pipeline module. `startLandmarkPipeline(video, onFrame, { maxFps, enablePose })` opens the camera (if needed), runs HandLandmarker (2 hands) and optionally PoseLandmarker (upper body, lite model) on-device, and calls `onFrame` with plain landmark vectors at up to 15 fps. Also exports `drawFrame` (canvas overlay), `createLandmarkQueue` (FIFO for the next stage), and `startCamera` / `stopCamera`.
- `../api/muse.js` - the only module that talks to the Meta Model API (muse-spark-1.3). `glossFromLandmarks` builds a compact text description of the window (finger extension heuristic, hand visibility, wrist travel) and asks for one gloss word or `FINGERSPELL:<letters>`. `glossToEnglish` turns the gloss into one short spoken sentence. `speakEnglish` uses the browser's built-in speechSynthesis (on-device, free).
- TODO: SAM 3.1 signer isolation (PRD step 3) is not wired in; MediaPipe landmarks are the input path and stay that way.
- TODO: FaceLandmarker for facial grammar markers (Direction B feedback).
- TODO: Direction B stubs in `../api/muse.js` (`transcribe`, `englishToGloss`) are not implemented.

## Run

From the repository root (any static server works; this one is built into macOS Python):

```
python3 -m http.server 8080
```

Then open http://localhost:8080/web/ in Chrome or Safari, allow the camera, and press "Start camera". The first run downloads MediaPipe wasm and model files, which can take a few seconds. Webcam access only works from localhost or HTTPS.

## API key (session only)

The key is never stored and never logged. Two ways to supply it:

1. Paste it into the "Muse API key (session only)" field on the page. It lives in the tab's memory until you close or reload it.
2. Inject it at serve time by defining `window.SIGNBRIDGE_API_KEY` before `app.js` loads (for example a tiny local wrapper HTML). When injected, the field is disabled.

Do not put the key in any file, URL, or commit. `.env` is gitignored.

## End-to-end flow (Live translate)

1. Camera runs, landmarks stream into the queue at up to 15 fps.
2. Every 2 seconds the app drains the queue into a window (at least 8 frames).
3. `glossFromLandmarks` sends Muse a compact text description of that window: hand visibility percentage, which fingers stayed extended, wrist travel. No frames, no images, no raw per-frame coordinates.
4. Muse Spark (muse-spark-1.3, temperature 0, max 30 tokens) replies with one gloss word from the fixed 40-sign coffee-shop vocabulary or `FINGERSPELL:<letters>`.
5. `glossToEnglish` asks Spark for one short natural sentence (max 40 tokens).
6. `speakEnglish` speaks it with the browser's built-in voice (on-device). The page shows gloss, sentence, and a running Muse call counter with cost context.

## Privacy note (known limitation of v1)

This slice sends a compact landmark-derived text description to Muse. That is within the privacy invariant: raw video never leaves the device, only derived vectors and descriptions. The description is lossy on purpose (finger states, visibility, motion summary), so Muse never sees images, video, or biometric frames.

## Budget

Spark pricing is roughly $0.6 in and $2.4 out per 1M tokens. One window costs about 2 calls of a few hundred tokens, so a busy demo session (a few hundred windows) lands in the cents. The page counts calls per session. muse-wonder-1.0 is not used ($4 in / $20 out per 1M). There is no hosted TTS; speech output is the browser voice.

## Manual verification checklist

Landmark pipeline (no key needed):

1. Page loads without console errors after pressing Start (give the model download a few seconds).
2. Webcam preview appears, mirrored, and the overlay draws green hand skeletons that follow your hands, plus a blue pose skeleton when the pose toggle is on.
3. Status line shows `hands: 1` or `hands: 2` when hands are visible and `hands: 0` when you move out of frame.
4. Status line rate stays near 15 fps on the MacBook webcam.
5. In devtools, `window.signbridge.queue.length` grows while running and `window.signbridge.getStats()` returns frame counts.
6. Check the browser's network tab: with Live translate off, no requests fire while running, and no image or video payloads are uploaded.
7. Stop clears the overlay and releases the camera (camera indicator light goes off).

Live translate (paste a valid key first):

8. Paste the key, tick "Live translate (Muse)", sign "coffee" (or any vocabulary sign) clearly toward the camera for a few seconds.
9. The Muse line cycles through `thinking...`, then `gloss: <word>`, then `said: <sentence>`. The sentence is spoken through the browser voice.
10. The Conversation panel shows the gloss under "What I signed" and the sentence under "English output", and the transcript list grows.
11. The call counter increases by 2 per recognized window and the budget line stays plausible.
12. Sign something outside the vocabulary. The expected output is `FINGERSPELL:<letters>` more often than a wrong vocabulary word.
13. Network tab while translating: only POSTs to `api.meta.ai/v1/chat/completions`, request payloads contain text descriptions only (readable in devtools), nothing else leaves the browser.
14. Bad key on purpose: the Muse line shows a clean error (HTTP 401 mapped), the app keeps running and keeps trying the next window.
