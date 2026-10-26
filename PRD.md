# SignBridge PRD

**Project:** SignBridge, a two-way sign language translator (ASL)
**Event:** Meta Global AI Developer Hackathon, indie track
**Status:** Approved 2026-10-26, build window ends Nov 4, 21:00 ET (Nov 5, 02:00 WAT)
**Source of truth:** `2026-10-26_signbridge-concept.md` (vault inbox brief)

## Problem

Roughly 70M Deaf people use a sign language as their primary language. ASL is not English: it has its own grammar, topic-comment order, and spatial referencing. The existing options are human interpreters (scarce, $50 to 100 per hour) or gimmick tools. Almost nobody builds speech to signing, the second direction. SignBridge addresses both directions for everyday transactions.

## Direction A: Sign to Voice

Pipeline:

1. Webcam capture in the browser.
2. MediaPipe hand and face landmarks, computed on-device.
3. SAM 3.1 signer isolation and hand crops.
4. Temporal model (TCN or transformer) trained on WLASL / MS-ASL.
5. Sign gloss sequence output.
6. Muse Spark rewrites gloss to fluent English.
7. Muse Wonder text-to-speech, spoken aloud.

Key decision: raw video never leaves the device. Only structured landmarks and motion descriptions go to the API. This keeps latency low and protects privacy (no biometric video uploaded). Fingerspelling is the fallback for out-of-vocabulary signs.

## Direction B: Voice to Sign (the differentiator)

Pipeline:

1. Microphone capture.
2. Muse Wonder speech-to-text.
3. Muse Spark translates English to ASL gloss, including topic-comment reorder (for example, "PIZZA YOU WANT WHICH?").
4. A Three.js WebGL avatar performs the dictionary-based sign sequence (SignBank data) with motion interpolation and facial grammar.

Generative video cannot do accurate hand articulation, so the rigged avatar performs the signs; Muse Image is used only for avatar appearance and branding. Judges respect not faking it.

## Scope

One domain: a coffee shop. Roughly 150 signs covering ordering, size, allergy, price, and thanks. Constrained vocabulary on purpose.

## 10-day plan (Oct 26 to Nov 4)

| Day | Dates | Work |
|---|---|---|
| 1 to 2 | Oct 26 to 27 | Vertical slice. Verify Muse API modalities and rate limits. Browser landmark pipeline. |
| 3 to 5 | Oct 28 to 30 | Direction A. Temporal model on WLASL, Muse Spark re-rank, fingerspelling. |
| 6 to 8 | Oct 31 to Nov 2 | Direction B. Avatar rig, gloss planner, tweening, Muse Wonder voice input. |
| 9 to 10 | Nov 3 to 4 | Two-way latency tuning, end-to-end integration, recorded backup demo. |

## Demo moment

Live: a person signs to the laptop and it speaks. A teammate speaks and the avatar signs back. Closing line: "We just had a conversation neither of us could have had yesterday." A recorded fallback demo is mandatory.

## Honest caveats

- Continuous sign recognition is an open research problem. Ship a constrained vocabulary, never claim interpreter replacement, and position SignBridge as an accessibility bridge for everyday transactions.
- Deaf community skepticism is deserved (translation glove history). Recruit a Deaf tester during build week and show their feedback in the video.
- ASL only. Other sign languages are roadmap.
- Recognition accuracy is the weakest number. Scope to a domain and show the fingerspelling fallback.
