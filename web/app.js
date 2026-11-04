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
import {
  describeWindow,
  glossFromDescription,
  glossToEnglish,
  speakEnglish,
  wordFromLetters,
} from "../api/muse.js";
import { createSpellingBuffer } from "./spelling.js";

const WINDOW_INTERVAL_MS = 1500; // one recognition window every 1.5 seconds
const MIN_FRAMES_PER_WINDOW = 6; // below this the window is too thin to read
const SPELLING_PAUSE_MS = 4500; // allows for model latency between recognized letters

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
let unclearCount = 0;

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
}

function refreshBudget() {
  budgetLine.textContent = "Muse calls this session: " + museCalls + " (unclear: " + unclearCount + ").";
}

function addTranscript(gloss, english) {
  const item = document.createElement("li");
  item.textContent = `${gloss} -> "${english}"`;
  transcriptList.prepend(item);
  while (transcriptList.children.length > 6) {
    transcriptList.removeChild(transcriptList.lastChild);
  }
}

// Fingerspelling state: letters accumulate across windows, a pause ends the
// word, a vocabulary gloss interrupts. Flush speaks the assembled word.
const spellingBuffer = createSpellingBuffer({
  resetMs: SPELLING_PAUSE_MS,
  onFlush: async (sequence, kind) => {
    try {
      if (kind === "letter") {
        refreshMuseLine(`spelled: ${sequence}`);
        signedValue.textContent = sequence;
        englishValue.textContent = sequence;
        addTranscript(sequence, sequence);
        speakEnglish(sequence);
        return;
      }
      const apiKey = getApiKey();
      refreshMuseLine(`spelled: ${sequence} | assembling word...`);
      const word = apiKey ? await wordFromLetters(sequence, { apiKey }) : sequence;
      if (apiKey) museCalls += 1;
      refreshMuseLine(`spelled: ${word}`);
      signedValue.textContent = sequence;
      englishValue.textContent = word;
      addTranscript(sequence, word);
      speakEnglish(word);
    } catch (err) {
      refreshMuseLine(`spelling error: ${err.message || err}`);
    } finally {
      refreshBudget();
    }
  },
});

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
  const description = describeWindow(frames);
  try {
    const gloss = await glossFromDescription(description, { apiKey });
    museCalls += 1;
    if (gloss === "unclear") {
      // Ambiguous windows are counted without translation or speech. A gap
      // lets the next identical letter be counted without ending the word.
      unclearCount += 1;
      if (spellingBuffer.snapshot()) spellingBuffer.noteGap();
      refreshMuseLine("unclear sign, try again");
      return;
    }
    const spelled = /^fingerspell:([a-z])$/.exec(gloss);
    if (spelled) {
      // Letter path: buffer it (dedupes held letters), show progress.
      const soFar = spellingBuffer.pushLetter(spelled[1]);
      refreshMuseLine(`spelled so far: ${soFar}`);
      return;
    }
    // Vocabulary path: a sign interrupts fingerspelling.
    spellingBuffer.interrupt();
    refreshMuseLine(`gloss: ${gloss} | translating...`);
    const english = await glossToEnglish(gloss, { apiKey });
    museCalls += 1;
    if (english === null) {
      // Model burned the cap on the translation step; speak the gloss itself.
      refreshMuseLine(`gloss: ${gloss} | said: ${gloss} (fallback)`);
      signedValue.textContent = gloss;
      englishValue.textContent = gloss;
      addTranscript(gloss, gloss);
      speakEnglish(gloss);
      return;
    }
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
  cameraState.textContent = "Starting";
  statusLine.textContent = "Opening camera and loading hand models...";
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
    refreshStatus();
  }
});

stopButton.addEventListener("click", () => {
  if (pipeline) {
    pipeline.stop();
    pipeline = null;
  }
  window.clearInterval(statusTimer);
  window.clearInterval(translateTimer);
  spellingBuffer.dispose();
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
