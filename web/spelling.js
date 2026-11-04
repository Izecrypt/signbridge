// SignBridge spelling buffer: cross-window memory for fingerspelling.
// Letters arrive one recognition window at a time; a held letter repeats
// across windows and must not double-append. A pause of `resetMs` with no new
// letter is the word boundary: flush. A vocabulary gloss interrupts spelling
// and flushes the buffer without speaking it. Pure logic, no DOM, testable in
// node.

/**
 * @param {{resetMs?: number, onFlush?: (sequence: string, kind: "letter"|"word") => void}} options
 */
export function createSpellingBuffer(options = {}) {
  const { resetMs = 4500, onFlush } = options;
  let letters = [];
  let lastLetter = null;
  let timer = null;

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function arm() {
    clearTimer();
    timer = setTimeout(flush, resetMs);
  }

  function flush() {
    timer = null;
    if (letters.length === 0) return;
    const sequence = letters.join("");
    const kind = letters.length === 1 ? "letter" : "word";
    letters = [];
    lastLetter = null;
    if (onFlush) onFlush(sequence, kind);
  }

  return {
    /**
     * Append a recognized letter. Dedupes against the last appended letter
     * (a held letter repeats across windows). Resets the pause timer.
     * @returns {string} current buffer contents
     */
    pushLetter(letter) {
      if (letter !== lastLetter) {
        letters.push(letter);
        lastLetter = letter;
      }
      arm();
      return letters.join("");
    },
    /**
     * A quiet or unclear recognition window separates repeated letters
     * (for example the two Ls in HELLO) without ending the whole word.
     */
    noteGap() {
      lastLetter = null;
    },
    /** Vocabulary gloss interrupted spelling: discard without speaking. */
    interrupt() {
      clearTimer();
      letters = [];
      lastLetter = null;
    },
    /** Current buffer contents for debug display. */
    snapshot() {
      return letters.join("");
    },
    dispose() {
      clearTimer();
      letters = [];
      lastLetter = null;
    },
  };
}
