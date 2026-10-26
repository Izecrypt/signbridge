# web/

Browser app for SignBridge. Plain HTML + ES modules, no build step. MediaPipe Tasks Vision loads from the jsDelivr CDN at runtime; model files load from MediaPipe model storage.

- `index.html` - demo page: webcam preview, landmark overlay, liveness indicator.
- `app.js` - page bootstrap: camera start/stop, overlay drawing, landmark queue, status line.
- `landmarks.js` - the landmark pipeline module. `startLandmarkPipeline(video, onFrame, { maxFps, enablePose })` opens the camera (if needed), runs HandLandmarker (2 hands) and optionally PoseLandmarker (upper body, lite model) on-device, and calls `onFrame` with plain landmark vectors at up to 15 fps. Also exports `drawFrame` (canvas overlay), `createLandmarkQueue` (FIFO for the next stage), and `startCamera` / `stopCamera`.
- TODO: temporal model on top of the queue, then Muse Spark / Wonder via `../api/muse.js` (`glossToSpeech` stub in `landmarks.js`).
- TODO: SAM 3.1 signer isolation (PRD step 3) is not wired in yet.
- TODO: FaceLandmarker for facial grammar markers (Direction B feedback).

## Run

From the repository root (any static server works; this one is built into macOS Python):

```
python3 -m http.server 8080
```

Then open http://localhost:8080/web/ in Chrome or Safari, allow the camera, and press "Start camera". The first run downloads MediaPipe wasm and model files, which can take a few seconds. Webcam access only works from localhost or HTTPS.

## Manual verification checklist

1. Page loads without console errors after pressing Start (give the model download a few seconds).
2. Webcam preview appears, mirrored, and the overlay draws green hand skeletons that follow your hands, plus a blue pose skeleton when the pose toggle is on.
3. Status line shows `hands: 1` or `hands: 2` when hands are visible and `hands: 0` when you move out of frame.
4. Status line rate stays near 15 fps on the MacBook webcam.
5. In devtools, `window.signbridge.queue.length` grows while running and `window.signbridge.getStats()` returns frame counts.
6. Check the browser's network tab: after the initial CDN and model downloads, no further requests fire while running, and no image or video payloads are uploaded.
7. Stop clears the overlay and releases the camera (camera indicator light goes off).
