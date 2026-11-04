import assert from "node:assert/strict";
import test from "node:test";
import { createSpellingBuffer } from "./spelling.js";

test("dedupes a held letter but preserves a repeated letter after a pause", () => {
  const buffer = createSpellingBuffer({ resetMs: 10000 });
  assert.equal(buffer.pushLetter("l"), "l");
  assert.equal(buffer.pushLetter("l"), "l");
  buffer.noteGap();
  assert.equal(buffer.pushLetter("l"), "ll");
  buffer.dispose();
});

test("assembles letters across a gap and flushes once after the word pause", async () => {
  let resolveFlush;
  const flushed = new Promise((resolve) => {
    resolveFlush = resolve;
  });
  const buffer = createSpellingBuffer({
    resetMs: 10,
    onFlush: (sequence, kind) => resolveFlush({ sequence, kind }),
  });
  buffer.pushLetter("h");
  buffer.noteGap();
  buffer.pushLetter("i");
  assert.deepEqual(await flushed, { sequence: "hi", kind: "word" });
  buffer.dispose();
});

test("a vocabulary interruption discards the partial spelling", () => {
  const buffer = createSpellingBuffer({ resetMs: 10000 });
  buffer.pushLetter("c");
  buffer.interrupt();
  assert.equal(buffer.snapshot(), "");
  buffer.dispose();
});
