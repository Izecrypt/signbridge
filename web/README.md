# web/

Browser app for SignBridge.

- `landmarks.js` - webcam capture plus the MediaPipe landmark pipeline module (stub interface). Runs fully on-device; only landmarks and motion descriptions leave the browser.
- TODO: app entry point and bundler setup (Vite planned). Not scaffolded yet on purpose; no node dependencies are installed.
- TODO: Muse API integration points are marked in `landmarks.js`; the client lives in `../api/muse.js`.
