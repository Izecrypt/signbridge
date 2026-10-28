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
2. Every 1.5 seconds the app drains the queue into a window (at least 6 frames).
3. `glossFromDescription` sends Muse the compact window description (see the debug panel for the exact text).
4. Muse Spark (muse-spark-1.3, temperature 0, reasoning_effort "minimal", max_tokens 512) replies with one gloss word from the fixed 40-sign coffee-shop vocabulary, `FINGERSPELL:<letter>`, or burns the cap and the app shows "unclear sign, try again".
5. Vocabulary gloss: interrupt any spelling in progress, translate with `glossToEnglish`, speak the sentence with the browser voice.
6. Letter: append to the spelling buffer (deduped against the last letter, so a held letter is not double-appended) and show "spelled so far: ...". A pause of 2.5s with no new letter ends the word: 2+ letters go to `wordFromLetters` ("water" becomes the spoken word "water", "xyzq" stays "xyzq"), a single letter is spoken as the letter itself.

Fingerspelling is a sequence task: isolated letters like D vs 1 vs pointing are undecidable alone, so single-letter fallback to unclear is correct behavior. Letters only resolve at word level, which is why the buffer exists.

## Muse behavior (verified in a live smoke test)

- muse-spark-1.3 always generates reasoning tokens before visible output. Requests set `reasoning_effort: "minimal"` (about 20 reasoning tokens on trivial inputs) and `max_tokens: 512` so distinctive inputs always have headroom.
- A distinctive window answers cleanly and fast (about 1 to 2 seconds, exact gloss).
- An ambiguous window deliberates until the cap and returns `content: null` with `finish_reason: "length"`. The app maps this to "unclear": the status line shows "unclear sign, try again", nothing is spoken, and the call is counted separately. It is never retried in a loop, so worst case cost per unclear window is one capped call (about 3 seconds).
- Expected cost per call is well under a tenth of a cent at Spark output pricing (about $2.4 per 1M tokens, and each call here is only a few hundred tokens). A full demo session costs cents against the $150 credit.

## Privacy note (known limitation of v1)

This slice sends a compact landmark-derived text description to Muse. That is within the privacy invariant: raw video never leaves the device, only derived vectors and descriptions. The description is lossy on purpose (finger states, visibility, motion summary), so Muse never sees images, video, or biometric frames.

## Budget

Spark pricing is roughly $0.6 in and $2.4 out per 1M tokens. One recognized window costs about 2 calls of a few hundred tokens (well under a tenth of a cent); an unclear window costs one capped call (about 512 tokens, still a tiny fraction of a cent). A busy demo session lands in the cents against the $150 credit. The page counts calls per session, including unclear ones separately. muse-wonder-1.0 is not used ($4 in / $20 out per 1M). There is no hosted TTS; speech output is the browser voice.

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
13. Wave your hand vaguely or sign nothing distinctive. The Muse line should show "unclear sign, try again" within about 3 seconds, nothing is spoken, and the unclear counter in the budget line goes up by one.
14. Network tab while translating: only POSTs to `api.meta.ai/v1/chat/completions`, request payloads contain text descriptions only (readable in devtools), nothing else leaves the browser.
15. Bad key on purpose: the Muse line shows a clean error (HTTP 401 mapped), the app keeps running and keeps trying the next window.
16. The "Debug (last 10 windows)" panel under the camera shows one entry per attempt: time, gloss (or unclear / error), the letters buffer state at that moment, and the exact description text sent to Muse. The same lines appear in the devtools console prefixed `SB-DEBUG`.

## Fingerspelling test

1. Fingerspell W-A-T-E-R, holding each letter about a second, with a clear pause (hand lowered or still) of about a second between letters. The Muse line should grow "spelled so far: w", "wa", "wat", ... and after the final pause speak "water".
2. Fingerspell something with no word form (like X-Y-Z-Q). After the pause it should speak the raw sequence "xyzq".
3. Immediately after a letter sequence, do a vocabulary sign (for example "water" or "hello"). The buffer must flush without speaking the letters, and the vocabulary path speaks the sentence.
4. Hold one letter steady for 4+ seconds. It must appear exactly once in "spelled so far" (dedupe), and after the pause only the single letter is spoken.

## Tuning workflow

When recognition falls back more than it should, do not guess at thresholds. Open the devtools console (or the Debug panel), copy 3 to 5 `SB-DEBUG` lines for a sign that worked and 3 to 5 for the signs that fell back (unclear or FINGERSPELL), and paste them to the agent. The failure is almost always visible in the description text itself (muddled shape fields, wrong visibility, jitter counted as motion).
