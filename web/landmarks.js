// SignBridge web pipeline: webcam capture and MediaPipe landmark extraction.
// Everything here runs on-device. Raw video never leaves the browser.

// TODO: choose bundler / app framework (Vite is the default plan) and wire this
// module into the app entry point.

export const LANDMARK_VERSION = "0.1.0-stub";

// TODO: import MediaPipe Tasks Vision (@mediapipe/tasks-vision) once node
// dependencies are installed. Planned tasks: HandLandmarker (2 hands),
// FaceLandmarker (facial grammar markers for Direction B feedback).

/**
 * Start webcam capture and run the landmark pipeline on every frame.
 *
 * @param {HTMLVideoElement} videoElement live webcam feed
 * @param {(frame: LandmarkFrame) => void} onFrame called per frame with landmarks
 * @returns {Promise<{ stop: () => void }>} handle with a stop function
 */
export async function startLandmarkPipeline(videoElement, onFrame) {
  // TODO: implement.
  // 1. getUserMedia via navigator.mediaDevices.
  // 2. Create HandLandmarker and FaceLandmarker with video mode.
  // 3. Loop with requestAnimationFrame; call onFrame with normalized
  //    landmark vectors only (no image frames).
  // 4. Optional: SAM 3.1 signer isolation / hand crops (PRD step 3).
  throw new Error("startLandmarkPipeline: not implemented (stub)");
}

/**
 * @typedef {Object} LandmarkFrame
 * @property {number} timestampMs
 * @property {Array<Array<{x: number, y: number, z: number}>>} hands up to 2 hands, 21 points each
 * @property {Array<{x: number, y: number, z: number}>|null} face face mesh points or null
 */

/**
 * TODO: Muse API integration.
 * After the temporal model (or a rules-based stub during days 1 to 2) turns
 * landmark windows into a sign gloss sequence, send the gloss text to
 * Muse Spark for re-ranking / translation to fluent English, then Muse
 * Wonder for text-to-speech. Use the client in ../api/muse.js. Keep all
 * Muse calls behind that module so no API key ever appears in this code.
 */
export async function glossToSpeech(glossSequence) {
  // TODO: call translateGlossToEnglish and speak from ../api/muse.js.
  throw new Error("glossToSpeech: not implemented (stub)");
}
