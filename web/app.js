// SignBridge demo page bootstrap: camera, overlay drawing, landmark queue,
// and a liveness indicator. No data leaves the browser; the queue only ever
// holds landmark vectors.

import {
  LANDMARK_VERSION,
  createLandmarkQueue,
  drawFrame,
  startLandmarkPipeline,
} from "./landmarks.js";

const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const poseToggle = document.getElementById("pose-toggle");
const statusLine = document.getElementById("status-line");
const errorBox = document.getElementById("error-box");

const ctx = canvas.getContext("2d");
const queue = createLandmarkQueue();

let pipeline = null;
let statusTimer = 0;
let startInProgress = false;

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

async function startFromUserInput(event) {
  event?.preventDefault();
  if (startInProgress || pipeline) return;
  startInProgress = true;
  clearError();
  startButton.disabled = true;
  statusLine.textContent =
    "Loading MediaPipe models. First run downloads them, can take 10 to 30 seconds on a slow connection...";
  try {
    // Size the overlay canvas to the video once frames flow.
    const sizeCanvas = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };
    if (video.videoWidth > 0) sizeCanvas();
    else video.addEventListener("loadeddata", sizeCanvas, { once: true });

    pipeline = await startLandmarkPipeline(
      video,
      (frame) => {
        queue.push(frame); // later stages (temporal model) drain this
        drawFrame(ctx, frame, { width: canvas.width, height: canvas.height });
      },
      { maxFps: 15, enablePose: poseToggle.checked }
    );
    setRunning(true);
    statusTimer = window.setInterval(refreshStatus, 500);
  } catch (err) {
    showError(`Could not start: ${err.message || err}`);
    setRunning(false);
  } finally {
    startInProgress = false;
  }
}

// Keep click as the normal path, with pointerup as a fallback for browsers or
// extensions that swallow the synthesized click after a physical press.
startButton.addEventListener("click", startFromUserInput);
startButton.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse" || event.pointerType === "touch" || event.pointerType === "pen") {
    startFromUserInput(event);
  }
});

stopButton.addEventListener("click", () => {
  if (pipeline) {
    pipeline.stop();
    pipeline = null;
  }
  window.clearInterval(statusTimer);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setRunning(false);
  refreshStatus();
});

setRunning(false);
refreshStatus();
console.log(`SignBridge landmark demo v${LANDMARK_VERSION}`);

// Debug handle for manual verification in devtools: frames drain from here.
window.signbridge = { queue, getStats: () => pipeline && pipeline.getStats() };
