# api/

Stub module for Muse API calls (Spark for text, Wonder for speech, Image for avatar appearance).

- `muse.js` - the only place Muse calls happen. It reads `MUSE_API_KEY` and `MUSE_BASE_URL` from environment variables. No API keys in the repo; `.env` is gitignored.

TODO: real HTTP implementation, confirmed endpoint paths, modality and rate-limit verification (days 1 to 2 of the build plan).
