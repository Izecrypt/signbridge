// SignBridge web pipeline: webcam capture and MediaPipe landmark extraction.
// Everything runs on-device in the browser. Raw video never leaves the device;
// only normalized landmark vectors are handed to the onFrame callback.
//
// MediaPipe Tasks Vision loads from the jsDelivr CDN at runtime, and the model
// files load from MediaPipe model storage. No build step is required.

import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  HAND_CONNECTIONS,
  POSE_CONNECTIONS,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

export const LANDMARK_VERSION = "0.2.0";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const DEFAULT_CAMERA = { width: 1280, height: 720 };

/**
 * Open the webcam and attach it to a video element.
 *
 * @param {HTMLVideoElement} videoElement
 * @param {{width?: number, height?: number}} [constraints]
 * @returns {Promise<MediaStream>} the camera stream (pass to stopCamera)
 */
export async function startCamera(videoElement, constraints = {}) {
  const { width, height } = { ...DEFAULT_CAMERA, ...constraints };
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: width },
      height: { ideal: height },
      facingMode: "user",
    },
    audio: false,
  });
  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

/** Stop a camera stream returned by startCamera. */
export function stopCamera(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

async function createLandmarkers(enablePose) {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const hand = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });
  let pose = null;
  if (enablePose) {
    pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }
  return { hand, pose };
}

/**
 * Start webcam capture and run the landmark pipeline.
 *
 * Frames are processed at most `options.maxFps` times per second. The callback
 * receives plain landmark vectors only; no image data is ever passed out.
 *
 * @param {HTMLVideoElement} videoElement live webcam feed (camera is opened
 *   automatically if the element has no stream yet)
 * @param {(frame: LandmarkFrame) => void} onFrame called per processed frame
 * @param {{maxFps?: number, enablePose?: boolean}} [options]
 * @returns {Promise<{stop: () => void, getStats: () => PipelineStats}>}
 */
export async function startLandmarkPipeline(videoElement, onFrame, options = {}) {
  const { maxFps = 15, enablePose = true } = options;
  let stream = null;
  if (!videoElement.srcObject) {
    stream = await startCamera(videoElement);
  } else {
    stream = videoElement.srcObject;
  }

  const { hand, pose } = await createLandmarkers(enablePose);

  const minIntervalMs = 1000 / maxFps;
  const stats = {
    fps: 0,
    handsDetected: 0,
    poseDetected: false,
    framesProcessed: 0,
  };

  let running = true;
  let rafId = 0;
  let lastProcessMs = 0;
  let fpsWindowStart = performance.now();
  let fpsWindowCount = 0;

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    if (videoElement.readyState < 2) return; // no frame decoded yet
    if (now - lastProcessMs < minIntervalMs) return;
    lastProcessMs = now;

    let frame;
    try {
      const handResult = hand.detectForVideo(videoElement, now);
      let poseLandmarks = null;
      if (pose) {
        const poseResult = pose.detectForVideo(videoElement, now);
        if (poseResult.landmarks.length > 0) {
          poseLandmarks = poseResult.landmarks[0];
        }
      }
      frame = {
        timestampMs: now,
        hands: handResult.landmarks.map((lm) =>
          lm.map((p) => ({ x: p.x, y: p.y, z: p.z }))
        ),
        face: null, // reserved for facial grammar markers (Direction B)
        pose: poseLandmarks
          ? poseLandmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }))
          : null,
        handedness: handResult.handedness.map((h) => h[0].categoryName),
      };
    } catch (err) {
      console.error("landmark detection failed:", err);
      return;
    }

    stats.framesProcessed += 1;
    stats.handsDetected = frame.hands.length;
    stats.poseDetected = frame.pose !== null;
    fpsWindowCount += 1;
    if (now - fpsWindowStart >= 1000) {
      stats.fps = Math.round((fpsWindowCount * 1000) / (now - fpsWindowStart));
      fpsWindowStart = now;
      fpsWindowCount = 0;
    }

    try {
      onFrame(frame);
    } catch (err) {
      console.error("onFrame callback failed:", err);
    }
  }

  rafId = requestAnimationFrame(loop);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      hand.close();
      if (pose) pose.close();
      if (videoElement.srcObject) {
        stopCamera(videoElement.srcObject);
        videoElement.srcObject = null;
      }
    },
    getStats() {
      return { ...stats };
    },
  };
}

/**
 * @typedef {Object} LandmarkFrame
 * @property {number} timestampMs
 * @property {Array<Array<{x: number, y: number, z: number}>>} hands up to 2 hands, 21 points each
 * @property {Array<{x: number, y: number, z: number}>|null} face face mesh points or null
 * @property {Array<{x: number, y: number, z: number}>|null} pose upper body pose points or null
 * @property {string[]} handedness "Left" / "Right" per detected hand
 */

/**
 * @typedef {Object} PipelineStats
 * @property {number} fps detection loop rate over the last second
 * @property {number} handsDetected hands in the most recent frame
 * @property {boolean} poseDetected pose in the most recent frame
 * @property {number} framesProcessed total frames processed
 */

/**
 * Simple FIFO queue for LandmarkFrames. A later stage (temporal model, then
 * Muse Spark via api/muse.js) drains this. Throttling happens upstream in the
 * pipeline loop, so this never grows unbounded.
 *
 * @param {{maxDepth?: number}} [options]
 */
export function createLandmarkQueue(options = {}) {
  const { maxDepth = 300 } = options; // 300 frames at 15 fps is 20 seconds
  const items = [];
  return {
    push(frame) {
      items.push(frame);
      if (items.length > maxDepth) items.shift();
    },
    /** Remove and return all queued frames. */
    drain() {
      return items.splice(0, items.length);
    },
    get length() {
      return items.length;
    },
  };
}

const HAND_POINT_COLOR = "#00e676";
const HAND_LINE_COLOR = "#00b248";
const POSE_POINT_COLOR = "#40c4ff";
const POSE_LINE_COLOR = "#0090d0";

function drawConnectedPoints(ctx, points, connections, width, height, pointColor, lineColor) {
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [from, to] of connections) {
    const a = points[from];
    const b = points[to];
    if (!a || !b) continue;
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
  }
  ctx.stroke();

  ctx.fillStyle = pointColor;
  for (const p of points) {
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw a LandmarkFrame as an overlay. Call with a 2D context whose canvas is
 * stacked on top of the video element.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {LandmarkFrame} frame
 * @param {{width: number, height: number, mirror?: boolean}} options
 */
export function drawFrame(ctx, frame, options) {
  const { width, height, mirror = true } = options;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  if (frame.pose) {
    drawConnectedPoints(ctx, frame.pose, POSE_CONNECTIONS, width, height, POSE_POINT_COLOR, POSE_LINE_COLOR);
  }
  for (const hand of frame.hands) {
    drawConnectedPoints(ctx, hand, HAND_CONNECTIONS, width, height, HAND_POINT_COLOR, HAND_LINE_COLOR);
  }
  ctx.restore();
}

/**
 * TODO: Muse API integration (blocked until Muse credits land).
 * After the temporal model turns landmark windows into a sign gloss sequence,
 * send the gloss text to Muse Spark for re-ranking / translation to fluent
 * English, then Muse Wonder for text-to-speech. Use the client in
 * ../api/muse.js. Keep all Muse calls behind that module so no API key ever
 * appears in this code.
 */
export async function glossToSpeech(glossSequence) {
  // TODO: call translateGlossToEnglish and speak from ../api/muse.js.
  throw new Error("glossToSpeech: not implemented (stub)");
}
