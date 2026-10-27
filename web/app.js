// SignBridge demo page bootstrap: camera, overlay drawing, landmark queue,
// and a liveness indicator. With Live translate on, it drains the queue in
// windows and runs the Muse slice: gloss -> English -> on-device speech.
// No video or image data ever leaves the browser; only compact text
// descriptions of landmark motion go to Muse, and only the API key holder
// triggers that.

import {
  LANDMARK_VERSION,
  createLandmarkQueue,
  drawFrame,
  startLandmarkPipeline,
} from "./landmarks.js";
import { glossFromLandmarks, glossToEnglish, speakEnglish } from "../api/muse.js";

const WINDOW_INTERVAL_MS = 2000; // one recognition window every 2 seconds
const MIN_FRAMES_PER_WINDOW = 8; // below this the window is too thin to read

const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const poseToggle = document.getElementById("pose-toggle");
const translateToggle = document.getElementById("translate-toggle");
const keyInput = document.getElementById("api-key");
const keyNote = document.getElementById("key-note");
const statusLine = document.getElementById("status-line");
const museLine = document.getElementById("muse-line");
const budgetLine = document.getElementById("budget-line");
const transcriptList = document.getElementById("transcript");
const signedValue = document.getElementById("signed-value");
const englishValue = document.getElementById("english-value");
const cameraState = document.getElementById("camera-state");
const errorBox = document.getElementById("error-box");

const ctx = canvas.getContext("2d");
const queue = createLandmarkQueue();

let pipeline = null;
let statusTimer = 0;
let translateTimer = 0;
let inFlight = false;
let museCalls = 0;

// Key source: a value injected at serve time (window.SIGNBRIDGE_API_KEY) or
// the session-only input field. Never persisted, never logged.
function getApiKey() {
  if (window.SIGNBRIDGE_API_KEY) return window.SIGNBRIDGE_API_KEY;
  return keyInput.value.trim();
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function setRunning(running) {
  startButton.disabled = running;
  stopButton.disabled = !running;
  poseToggle.disabled = running;
  cameraState.textContent = running ? "Camera on" : "Camera off";
  if (!running) refreshMuseLine("idle");
}

function refreshStatus() {
  if (!pipeline) {
    statusLine.textContent = "Idle. Press Start.";
    return;
  }
  const s = pipeline.getStats();
  statusLine.textContent =
    `hands: ${s.handsDetected} | pose: ${s.poseDetected ? "yes" : "no"} | ` +
    `rate: ${s.fps} fps | processed: ${s.framesProcessed} | queued: ${queue.length}`;
}

function refreshMuseLine(state) {
  museLine.textContent = `Muse: ${state}`;
}function refreshBudget() {
  budgetLine.textContent =
    `Muse calls this session: ${museCalls}. Spark runs about $0.6 in and $2.4 out ` +
    `per 1M tokens, so each call here is a tiny fraction of a cent.`;
}

function addTranscript(gloss, english) {
  const item = document.createElement("li");
  item.textContent = `${gloss} -> "${english}"`;
  transcriptList.prepend(item);
  while (transcriptList.children.length > 6) {
    transcriptList.removeChild(transcriptList.lastChild);
  }
}

async function runTranslateWindow() {
  if (!pipeline || !translateToggle.checked || inFlight) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    refreshMuseLine("waiting for API key (paste it above, session only)");
    return;
  }
  const frames = queue.drain();
  if (frames.length < MIN_FRAMES_PER_WINDOW) return; // nothing worth reading

  inFlight = true;
  refreshMuseLine("thinking...");
  try {
    const gloss = await glossFromLandmarks(frames, { apiKey });
    museCalls += 1;
    refreshMuseLine(`gloss: ${gloss} | translating...`);
    const english = await glossToEnglish(gloss, { apiKey });
    museCalls += 1;
    refreshMuseLine(`gloss: ${gloss} | said: ${english}`);
    signedValue.textContent = gloss;
    englishValue.textContent = english;
    addTranscript(gloss, english);
    speakEnglish(english);
  } catch (err) {
    refreshMuseLine(`error: ${err.message || err}`);
  } finally {
    inFlight = false;
    refreshBudget();
  }
}

startButton.addEventListener("click", async () => {
  clearError();
  startButton.disabled = true;
  try {
    const sizeCanvas = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };
    if (video.videoWidth > 0) sizeCanvas();
    else video.addEventListener("loadeddata", sizeCanvas, { once: true });

    pipeline = await startLandmarkPipeline(
      video,
      (frame) => {
        queue.push(frame); // windows for Muse drain from this queue
        drawFrame(ctx, frame, { width: canvas.width, height: canvas.height });
      },
      { maxFps: 15, enablePose: poseToggle.checked }
    );
    setRunning(true);
    statusTimer = window.setInterval(refreshStatus, 500);
    translateTimer = window.setInterval(runTranslateWindow, WINDOW_INTERVAL_MS);
  } catch (err) {
    showError(`Could not start: ${err.message || err}`);
    setRunning(false);
  }
});

stopButton.addEventListener("click", () => {
  if (pipeline) {
    pipeline.stop();
    pipeline = null;
  }
  window.clearInterval(statusTimer);
  window.clearInterval(translateTimer);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setRunning(false);
  refreshStatus();
});

if (window.SIGNBRIDGE_API_KEY) {
  keyInput.placeholder = "Key injected at serve time";
  keyInput.disabled = true;
  keyNote.textContent = "API key injected at serve time (window.SIGNBRIDGE_API_KEY). Nothing is stored.";
} else {
  keyNote.textContent =
    "API key stays in this tab's memory only. It is never saved, never logged, never sent anywhere except Muse.";
}

setRunning(false);
refreshStatus();
refreshBudget();
console.log(`SignBridge landmark demo v${LANDMARK_VERSION}`);

// Debug handle for manual verification in devtools: frames drain from here.
window.signbridge = { queue, getStats: () => pipeline && pipeline.getStats() };
