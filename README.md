# SignBridge

Two-way sign language translator (ASL) for the Meta Global AI Developer Hackathon, indie track.

Roughly 70M Deaf people use a sign language as their primary language, and ASL is not English (own grammar, topic-comment order, spatial referencing). SignBridge bridges both directions of a conversation in a constrained domain (a coffee shop, about 150 signs), as an accessibility tool for everyday transactions, not an interpreter replacement.

## Direction A: Sign to Voice

```
webcam -> MediaPipe landmarks (on-device) -> SAM 3.1 signer isolation
  -> temporal model (WLASL / MS-ASL) -> sign gloss
  -> Muse Spark: gloss to English -> Muse Wonder TTS
```

Raw video never leaves the device. Only structured landmarks and motion descriptions go to the API. Fingerspelling covers out-of-vocabulary signs.

## Direction B: Voice to Sign

```
microphone -> Muse Wonder STT -> Muse Spark: English to ASL gloss
  -> Three.js avatar performs dictionary signs (SignBank)
```

The rigged avatar performs signs with motion interpolation and facial grammar. Generative video cannot do accurate hand articulation, so it is used only for avatar appearance and branding.

## Quickstart

TODO: quickstart instructions once the build tooling is in place (web app bundler, API key setup via environment variables). No dependencies are installed yet.

## Repository layout

- `web/` - browser app: webcam capture and the MediaPipe landmark pipeline module
- `avatar/` - Three.js avatar rig placeholder and sign dictionary loader stub
- `api/` - stub client for Muse Spark / Muse Wonder calls (env-var based, no keys in the repo)
- `data/` - notes on WLASL, MS-ASL, and SignBank sources and licenses (no datasets committed)

## Hackathon attribution

Built for the Meta Global AI Developer Hackathon, indie track. Approved 2026-10-26, build window ends Nov 4, 2026.

## License

MIT. Copyright Ize, 2026. See `LICENSE`.
