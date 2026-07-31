---
applyTo: "src/services/**/*.js"
---

- Services are pure logic; they must not touch the DOM directly.
- If a service needs to read/write state, it does so via the Alpine store (or receives data as parameters).
- Persistence (`localStorage`) may only happen inside `storage.js`.
- Audio logic stays in `audio.js`; never spawn `new Audio()` elsewhere.
- Use `export` for public functions; do not attach functions to `window` unless necessary for the store bridge (and document why).