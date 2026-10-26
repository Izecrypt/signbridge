// SignBridge Muse API client stub.
// Single place where all Muse (Spark / Wonder / Image) calls live.
//
// Setup: put the API key in a MUSE_API_KEY environment variable (see .env,
// which is gitignored). Never commit keys, never hardcode them here.

const API_KEY = typeof process !== "undefined" ? process.env.MUSE_API_KEY : undefined;
const BASE_URL = process.env.MUSE_BASE_URL || "https://api.muse.example/v1";

/**
 * @param {string} model "spark" | "wonder" | "image"
 * @param {Object} payload model-specific request body
 * @returns {Promise<Object>} parsed response
 */
async function callMuse(model, payload) {
  if (!API_KEY) {
    throw new Error("MUSE_API_KEY is not set. Add it to your environment (.env is gitignored).");
  }
  // TODO: implement the actual HTTP call (fetch). Confirm endpoint paths,
  // modalities, and rate limits with the Muse API docs during days 1 to 2.
  throw new Error(`callMuse(${model}): not implemented (stub)`);
}

/**
 * Direction A step 6: rewrite a sign gloss sequence into fluent English.
 * Example input: ["PIZZA", "YOU", "WANT", "WHICH"].
 *
 * @param {string[]} glossSequence
 * @returns {Promise<string>} English sentence
 */
export async function translateGlossToEnglish(glossSequence) {
  // TODO: prompt Muse Spark. Include domain context (coffee shop) so the
  // re-rank stays within the constrained vocabulary.
  return callMuse("spark", { glossSequence });
}

/**
 * Direction A step 7: speak an English sentence aloud.
 *
 * @param {string} text
 * @returns {Promise<{ audioUrl: string, durationMs: number }>}
 */
export async function speak(text) {
  // TODO: Muse Wonder text-to-speech. Decide streaming vs buffered for
  // latency during the two-way demo tuning (days 9 to 10).
  return callMuse("wonder", { text });
}

/**
 * Direction B step 2: transcribe microphone audio.
 *
 * @param {Blob} audioChunk
 * @returns {Promise<string>} English transcript
 */
export async function transcribe(audioChunk) {
  // TODO: Muse Wonder speech-to-text.
  return callMuse("wonder", { audioChunk });
}

/**
 * Direction B step 3: translate English to an ASL gloss sequence with
 * topic-comment reorder. Example: "Which pizza do you want?" becomes
 * ["PIZZA", "YOU", "WANT", "WHICH"].
 *
 * @param {string} english
 * @returns {Promise<string[]>} gloss sequence for the avatar
 */
export async function englishToGloss(english) {
  // TODO: prompt Muse Spark. Ask for gloss only, ordered for signing, with
  // fingerspelling markers for out-of-vocabulary words.
  return callMuse("spark", { english });
}
