// SignBridge Muse API client. Browser module, plain fetch, no build step.
// This is the only module allowed to call model APIs.
//
// Key handling: the caller passes the key in per call (from a session-only
// input field or a window.SIGNBRIDGE_API_KEY value injected at serve time).
// Nothing here reads files, persists keys, or logs them.
//
// Confirmed facts (Meta Model API, OpenAI-compatible):
// - Base URL: https://api.meta.ai/v1, POST /chat/completions.
// - Auth: Bearer key, from env or pasted at runtime. Never committed.
// - Our slice model: muse-spark-1.3 (3000 RPM / 4M TPM per team).
// - There is NO hosted TTS. Speech output uses the browser speechSynthesis
//   API (on-device, free). muse-wonder-1.0 is expensive and not used here.

const BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_MODEL = "muse-spark-1.3";
const REQUEST_TIMEOUT_MS = 10000;

// Starter coffee-shop vocabulary (about 150 signs is the full domain scope;
// this is the recognition set for the v1 slice).
export const VOCABULARY = [
  "hello", "coffee", "tea", "milk", "sugar", "water", "order", "pay",
  "price", "yes", "no", "thank-you", "please", "help", "want", "have",
  "eat", "food", "menu", "small", "medium", "large", "hot", "cold", "ice",
  "cup", "table", "here", "to-go", "bag", "receipt", "card", "cash",
  "change", "name", "call", "wait", "where", "bathroom", "sorry",
];

/** Error with a machine-readable kind for the UI to map. */
export class MuseError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "MuseError";
    this.kind = kind; // "no-key" | "network" | "timeout" | "http" | "parse" | "input"
  }
}

/**
 * Result of one chat completion. `text` is null when the model spent the
 * whole token budget on reasoning (content null, finish_reason "length").
 * That is a first-class outcome, not an error: it means the input was too
 * ambiguous for the model to answer within the cap.
 *
 * @typedef {Object} CompletionResult
 * @property {string|null} text
 * @property {string} finishReason
 */

async function chatCompletion(messages, { apiKey, model = DEFAULT_MODEL, maxTokens = 512 }) {
  if (!apiKey) {
    throw new MuseError("no-key", "No API key. Paste it into the key field (session only).");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0,
        // muse-spark-1.3 always reasons before answering; minimal effort
        // keeps trivial inputs to about 20 reasoning tokens while ambiguous
        // inputs still burn the cap and return null content (mapped to
        // "unclear" by the caller, never retried in a loop).
        reasoning_effort: "minimal",
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new MuseError("timeout", "Muse request timed out after 10s.");
    }
    throw new MuseError("network", `Could not reach Muse: ${err.message || err}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const snippet = (await response.text()).slice(0, 200);
    throw new MuseError("http", `Muse HTTP ${response.status}: ${snippet}`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new MuseError("parse", "Muse returned a response that is not JSON.");
  }
  const choice = data.choices && data.choices[0];
  const finishReason = choice && choice.finish_reason ? choice.finish_reason : "unknown";
  const content = choice && choice.message ? choice.message.content : null;
  return { text: content && content.trim() ? content.trim() : null, finishReason };
}

// ---------------------------------------------------------------------------
// Landmark window description (runs on-device; only this text goes to Muse)
// ---------------------------------------------------------------------------

const WRIST = 0;
// Fingers in anatomical order, thumb excluded from spread logic.
const FINGER_ORDER = ["index", "middle", "ring", "pinky"];
// Finger tips and the joint one step in from the tip.
const FINGER_JOINTS = {
  thumb: { tip: 4, mid: 3 },
  index: { tip: 8, mid: 6 },
  middle: { tip: 12, mid: 10 },
  ring: { tip: 16, mid: 14 },
  pinky: { tip: 20, mid: 18 },
};

function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// Cheap extension heuristic: a finger counts as extended when its tip is
// further from the wrist than the joint below the tip.
function fingerExtended(hand, { tip, mid }) {
  return dist2d(hand[tip], hand[WRIST]) > dist2d(hand[mid], hand[WRIST]) * 1.05;
}

// Adjacent (index to pinky as one group) or split (gaps between extended
// fingers, the ASL distinction behind letters like "C" vs "V" shapes).
function spreadDescription(extended) {
  const set = new Set(extended.filter((f) => f !== "thumb"));
  const positions = FINGER_ORDER.map((f, i) => (set.has(f) ? i : -1)).filter((i) => i >= 0);
  if (positions.length === 0) return "no fingers extended";
  if (positions.length === 1) return "one finger extended";
  const gaps = positions[positions.length - 1] - positions[0] + 1 - positions.length;
  return gaps === 0 ? "extended fingers adjacent" : "extended fingers split";
}

// Back-and-forth count: direction reversals along the axis that moves most.
// Two or more means the sign has a repeated or oscillating component.
function reversalCount(points) {
  let xReversals = 0;
  let yReversals = 0;
  let prevDx = 0;
  let prevDy = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.abs(dx) > 0.004) {
      if (prevDx !== 0 && Math.sign(dx) !== Math.sign(prevDx)) xReversals += 1;
      prevDx = dx;
    }
    if (Math.abs(dy) > 0.004) {
      if (prevDy !== 0 && Math.sign(dy) !== Math.sign(prevDy)) yReversals += 1;
      prevDy = dy;
    }
  }
  return Math.max(xReversals, yReversals);
}

function motionDescription(handFrames) {
  const points = handFrames.map((h) => h[WRIST]);
  const reversals = reversalCount(points);
  const travel = dist2d(points[0], points[points.length - 1]);
  if (reversals >= 2) {
    return `repeated motion (${reversals} direction changes), travel ${round2(travel)}`;
  }
  if (travel > 0.05) return `moves across frame, travel ${round2(travel)}`;
  return "mostly stationary";
}

function summarizeHand(handFrames, label) {
  if (handFrames.length === 0) return null;
  const extendedCounts = { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 };
  for (const hand of handFrames) {
    for (const finger of Object.keys(extendedCounts)) {
      if (fingerExtended(hand, FINGER_JOINTS[finger])) extendedCounts[finger] += 1;
    }
  }
  const n = handFrames.length;
  const extended = Object.entries(extendedCounts)
    .filter(([, c]) => c / n >= 0.5)
    .map(([f]) => f);
  return { label, extended };
}

// ---------------------------------------------------------------------------
// Letter-discrimination features (fingerspelling). Computed from raw landmark
// coordinates; only the compact text goes to Muse.
// ---------------------------------------------------------------------------

function palmLength(hand) {
  return dist2d(hand[WRIST], hand[9]); // wrist to middle knuckle
}

// Curl depth as tip-to-wrist distance in palm lengths. A vs E vs S differ
// here: a plain fist reads tucked, fingertips driven under reads tucked with
// tips touching, half curl is the C/O family.
function curlBucketFor(hand, joints) {
  const ratio = dist2d(hand[joints.tip], hand[WRIST]) / palmLength(hand);
  if (ratio >= 1.7) return "extended";
  if (ratio >= 1.3) return "half";
  return "tucked";
}

function pointToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return dist2d(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function sideOf(p, a, b) {
  return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
}

// Thumb position class: "across" (tip over the front of curled fingers, the
// S/M/N family), "between" (tip seated in the index-middle gap on the finger
// side, the T/K family), "folded over palm" (thumb tip back over the palm,
// the B family), or "alongside" (outside the fist, the A family).
function thumbClassFor(hand) {
  const pl = palmLength(hand);
  const tip = hand[4];
  const dAcross = Math.min(dist2d(tip, hand[6]), dist2d(tip, hand[10])) / pl;
  if (dAcross < 0.45) return "across";
  const dBetween = pointToSegment(tip, hand[5], hand[9]) / pl;
  if (dBetween < 0.4) {
    const fingerSide = sideOf(hand[8], hand[5], hand[9]);
    if (sideOf(tip, hand[5], hand[9]) === fingerSide) return "between";
    return "folded over palm";
  }
  return "alongside";
}

// Are the four fingertips bunched together (E, O) or spread apart?
function tipsClusterFor(hand) {
  const pl = palmLength(hand);
  const tips = [8, 12, 16, 20].map((i) => hand[i]);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < tips.length; i += 1) {
    for (let j = i + 1; j < tips.length; j += 1) {
      sum += dist2d(tips[i], tips[j]);
      count += 1;
    }
  }
  return sum / count < 0.3 * pl ? "tips touching" : "tips apart";
}

// Image-plane pointing direction of the knuckle row (palm facing sideways vs
// up vs down). Camera-facing orientation from z is too noisy to trust.
function pointingFor(hand) {
  const dx = hand[9].x - hand[WRIST].x;
  const dy = hand[9].y - hand[WRIST].y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "points up" : "points down";
  return "points sideways";
}

function majority(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// Per-hand shape line for letters: curl depth per finger, thumb class,
// fingertip clustering, pointing direction. Majority vote across frames.
function shapeDescription(handFrames) {
  const curlVotes = { index: [], middle: [], ring: [], pinky: [] };
  const thumbVotes = [];
  const clusterVotes = [];
  const pointingVotes = [];
  for (const hand of handFrames) {
    for (const finger of Object.keys(curlVotes)) {
      curlVotes[finger].push(curlBucketFor(hand, FINGER_JOINTS[finger]));
    }
    thumbVotes.push(thumbClassFor(hand));
    clusterVotes.push(tipsClusterFor(hand));
    pointingVotes.push(pointingFor(hand));
  }
  const curls = Object.keys(curlVotes)
    .map((f) => `${f} ${majority(curlVotes[f])}`)
    .join(", ");
  return (
    `shape: ${curls}, thumb ${majority(thumbVotes)}, ` +
    `${majority(clusterVotes)}, ${majority(pointingVotes)}`
  );
}

/**
 * Turn a window of LandmarkFrames into compact text. This text, and only this
 * text, is what leaves the device for Muse. No images, no video, no raw
 * per-frame coordinates beyond these summaries. Coverage: per-hand visibility
 * and extended-finger sets, finger spread (adjacent vs split), motion type
 * (stationary, moving, or repeated with a reversal count), letter-shape
 * features (curl depth per finger, thumb position class, fingertip
 * clustering, pointing direction), relative hand height, and approach vs
 * separation between the two hands.
 *
 * @param {Array<import("../web/landmarks.js").LandmarkFrame>} frames
 * @returns {string} roughly 70 to 90 tokens
 */
export function describeWindow(frames) {
  if (!frames || frames.length === 0) {
    throw new MuseError("input", "No landmark frames to describe.");
  }
  const start = frames[0].timestampMs;
  const end = frames[frames.length - 1].timestampMs;
  const seconds = Math.max(0.1, (end - start) / 1000).toFixed(1);

  const bySlot = [[], []];
  const labels = [null, null];
  for (const frame of frames) {
    frame.hands.forEach((hand, i) => {
      bySlot[i].push(hand);
      const name = frame.handedness && frame.handedness[i];
      if (name && labels[i] === null) labels[i] = name;
    });
  }

  const lines = [`Sign window: ${frames.length} frames over ${seconds}s.`];
  for (let i = 0; i < 2; i += 1) {
    const role = i === 0 ? "Dominant" : "Non-dominant";
    const summary = summarizeHand(bySlot[i], labels[i] || `hand-${i + 1}`);
    if (!summary) {
      lines.push(`${role} hand: not visible.`);
      continue;
    }
    const seenPct = Math.round((bySlot[i].length / frames.length) * 100);
    const fingers = summary.extended.length ? summary.extended.join(" ") : "none";
    lines.push(
      `${role} hand (${summary.label}): visible ${seenPct}%, extended: ${fingers}, ` +
      `${spreadDescription(summary.extended)}, ${motionDescription(bySlot[i])}. ` +
      `${shapeDescription(bySlot[i])}.`
    );
  }

  // Two-hand relations: approach vs separation and relative height.
  const both = frames.filter((f) => f.hands.length >= 2);
  if (both.length >= 3) {
    const gaps = both.map((f) => dist2d(f.hands[0][WRIST], f.hands[1][WRIST]));
    const deltaGap = gaps[gaps.length - 1] - gaps[0];
    const avgY0 = both.reduce((s, f) => s + f.hands[0][WRIST].y, 0) / both.length;
    const avgY1 = both.reduce((s, f) => s + f.hands[1][WRIST].y, 0) / both.length;
    let move;
    if (Math.abs(deltaGap) > 0.05) {
      move = deltaGap < 0
        ? `hands approach (gap ${round2(gaps[0])} to ${round2(gaps[gaps.length - 1])})`
        : `hands separate (gap ${round2(gaps[0])} to ${round2(gaps[gaps.length - 1])})`;
    } else {
      move = "hands keep similar distance";
    }
    const height =
      avgY0 < avgY1 - 0.03 ? "dominant higher" :
      avgY0 > avgY1 + 0.03 ? "dominant lower" : "hands at similar height";
    lines.push(`Two hands: ${move}, ${height}.`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Direction A stage: landmarks -> gloss -> English -> speech
// ---------------------------------------------------------------------------

const LETTER_CUES = [
  "Letter-shape cues may appear in the description: curl depth per finger (extended, half, tucked), thumb position (alongside, across, between), fingertip clustering (touching or apart), pointing direction.",
  "Common fingerspelled letters for reference:",
  "a fist with thumb alongside;",
  "b flat palm fingers up thumb folded across palm;",
  "c curved open hand;",
  "d index up fingers together thumb touches middle;",
  "e fingers curled with fingertips tucked under;",
  "f index and thumb form a circle other fingers up;",
  "g fist thumb and index extended pointing sideways;",
  "i fist with pinky up;",
  "k index and middle up in a V thumb between them;",
  "l index up thumb out forming an L;",
  "m thumb folded across three fingers;",
  "n thumb folded across two fingers;",
  "o rounded closed fist;",
  "p like k pointing down;",
  "q like g pointing down;",
  "r index and middle crossed;",
  "s fist thumb across the front;",
  "t thumb tip between index and middle;",
  "u index and middle up together;",
  "v index and middle up split;",
  "w index middle ring up thumb over pinky;",
  "x index hooked;",
  "y thumb and pinky out;",
  "z like g drawing a Z in the air.",
  "When the described shape matches a letter, reply FINGERSPELL:<letter> instead of a vocabulary word.",
].join(" ");

const GLOSS_SYSTEM = [
  "You are the sign recognition stage of a two-way ASL translation demo in a coffee shop.",
  "The user message describes hand shape and motion captured as on-device landmarks from a webcam.",
  "It never contains images or video.",
  "Reply with exactly one of:",
  "(1) one gloss word from this fixed vocabulary: " + VOCABULARY.join(", ") + ";",
  "(2) FINGERSPELL:<letters> when the motion does not confidently match any vocabulary sign.",
  LETTER_CUES,
  "Rules: output the gloss or the FINGERSPELL value only, lowercase, no punctuation, no quotes, no explanation.",
  "If unsure, always prefer FINGERSPELL over guessing a vocabulary word, and prefer FINGERSPELL over unclear.",
].join(" ");

/**
 * Ask muse-spark-1.3 to pick a candidate gloss for a window of landmark
 * frames. Sends only the compact text description produced by
 * describeWindow; no landmark arrays or images leave the device.
 *
 * When the description is too ambiguous for the model to decide within the
 * token cap (content null, finish_reason "length"), returns "unclear". That
 * is a first-class outcome: the caller shows "unclear sign, try again" and
 * does not speak or translate. It is never retried in a loop.
 *
 * @param {Array<Object>} frames window of LandmarkFrames
 * @param {{apiKey: string, model?: string}} options
 * @returns {Promise<string>} gloss word, "FINGERSPELL:<letters>", or "unclear"
 */
export async function glossFromLandmarks(frames, options) {
  const description = describeWindow(frames);
  const { text } = await chatCompletion(
    [
      { role: "developer", content: GLOSS_SYSTEM },
      { role: "user", content: description },
    ],
    { apiKey: options.apiKey, model: options.model }
  );
  if (text === null) return "unclear";
  return text.replace(/^["'\s]+|["'\s]+$/g, "").toLowerCase();
}

const ENGLISH_SYSTEM = [
  "You turn one ASL gloss into a short natural English sentence for a coffee shop transaction.",
  "Input is a single gloss word or FINGERSPELL:<letters>.",
  "Rules: output one sentence only, at most 12 words, something a customer or barista would actually say.",
  "For FINGERSPELL:<letters>, build the sentence around the spelled word.",
  "No quotes, no explanation.",
].join(" ");

/**
 * Convert a gloss (or FINGERSPELL value) to a spoken-style English sentence.
 * Returns null if the model burned the token cap (ambiguous input); the
 * caller can then fall back to speaking the raw gloss.
 *
 * @param {string} gloss
 * @param {{apiKey: string, model?: string}} options
 * @returns {Promise<string|null>}
 */
export async function glossToEnglish(gloss, options) {
  const { text } = await chatCompletion(
    [
      { role: "developer", content: ENGLISH_SYSTEM },
      { role: "user", content: gloss },
    ],
    { apiKey: options.apiKey, model: options.model }
  );
  if (text === null) return null;
  return text.replace(/^["'\s]+|["'\s]+$/g, "");
}

/**
 * Speak text with the browser's built-in speechSynthesis (on-device, free).
 * There is no hosted TTS in the Meta Model API, so this is the speech path
 * for the demo. Cancels any utterance still in progress.
 *
 * @param {string} text
 * @param {{rate?: number}} [options]
 */
export function speakEnglish(text, options = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.warn("speechSynthesis is not available in this browser.");
    return;
  }
  const { rate = 1 } = options;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang === "en-US" && v.localService) ||
    voices.find((v) => v.lang && v.lang.startsWith("en"));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// Direction B stubs (not needed for this slice; kept for the plan)
// ---------------------------------------------------------------------------

/**
 * Direction B step 2 (stub, later): speech-to-text via
 * muse-voice-transcribe-1.0, POST /v1/asr/transcribe. Not implemented in this
 * slice.
 */
export async function transcribe(audioChunk, options) {
  void audioChunk;
  void options;
  throw new MuseError("input", "transcribe: not implemented yet (Direction B).");
}

/**
 * Direction B step 3 (stub, later): English to ASL gloss sequence with
 * topic-comment reorder via muse-spark-1.3. Not implemented in this slice.
 */
export async function englishToGloss(english, options) {
  void english;
  void options;
  throw new MuseError("input", "englishToGloss: not implemented yet (Direction B).");
}
