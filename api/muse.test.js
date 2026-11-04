import assert from "node:assert/strict";
import test from "node:test";
import {
  glossFromDescription,
  glossToEnglish,
  wordFromLetters,
} from "./muse.js";

const originalFetch = globalThis.fetch;

function mockCompletion(text) {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: "stop", message: { content: text } }],
    }),
  });
}

test("accepts a vocabulary gloss and rejects invalid recognition output", async () => {
  try {
    mockCompletion("COFFEE");
    assert.equal(await glossFromDescription("hand shape", { apiKey: "test-key" }), "coffee");
    mockCompletion("FINGERSPELL:HELLO");
    assert.equal(await glossFromDescription("hand shape", { apiKey: "test-key" }), "unclear");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to the letters if word assembly returns extra text", async () => {
  try {
    mockCompletion("water is likely");
    assert.equal(await wordFromLetters("watre", { apiKey: "test-key" }), "watre");
    mockCompletion("water");
    assert.equal(await wordFromLetters("watre", { apiKey: "test-key" }), "water");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects overlong speech output", async () => {
  try {
    mockCompletion("one two three four five six seven eight nine ten eleven twelve thirteen");
    assert.equal(await glossToEnglish("coffee", { apiKey: "test-key" }), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
