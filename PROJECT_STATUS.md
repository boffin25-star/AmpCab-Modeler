# Project Status — Amp Cab Modeler

Last updated: 2026-09-23

## Shipped
- Vite + React scaffold
- Vercel project created and git-linked (`boffin25-star/AmpCab-Modeler` → auto-deploy on push)
- Upload → decode → model select → process → download-WAV UI (working, minus the actual model inference)
- WAV export encoder (works standalone, tested logic only — not yet run against real processed audio)
- **"Find a tone" panel** (`src/ToneFinder.jsx`), two modes, both client-side / no backend:
  - *Describe it*: text lookup against `src/data/toneReferences.js`. Seeded with only what's been
    actually verified (Bad Omens) plus generic genre keywords (djent, nu metal, vintage, clean, blues,
    punk, etc.) — deliberately not pre-filled with guessed gear for other bands. Falls through to genre
    keywords, then a "no match" message.
  - *Upload a track*: `src/lib/toneAnalysis.js` runs a chunked FFT (band-energy % across 7 bands + crest
    factor) entirely in-browser — same technique used manually on We_All_Carry_Something.wav, ported from
    Python to JS. Produces a plain-language note + starter tags. UI explicitly warns this reflects the
    whole file (drums/bass/vocals included) unless the upload is an isolated guitar track — no source
    separation here.
  - Both modes link out to `tone3000.com/search?tags=...` rather than trying to fetch results ourselves.
- **Tone shape controls** (`src/lib/toneShaper.js` + sliders in `App.jsx`): Input Gain, Bass, Mid, Treble,
  Output Gain — native Web Audio (GainNode + 3x BiquadFilterNode), no dependency. Worth remembering:
  Bass/Mid/Treble here is a post-amp EQ (like an outboard pedal), not the amp's own tone stack — a NAM
  capture is one fixed knob setting.
- **Cabinet IR convolution** (`src/lib/cabinet.js`): native `ConvolverNode`, no dependency. Real IR file
  in hand and wired (`Mesa_OS_4x12_57_m160.wav`, Mesa OS 412 SM57+M160 from TONE3000 — verified legit,
  small zip containing one wav, matches what an IR should look like).
- **Full chain + live preview**: NAM (bypassed→dry for now) → Cabinet IR → Tone EQ → export. `Process`
  gracefully bypasses the still-unwired NAM stage (falls back to dry signal, shows a visible notice)
  instead of hard-failing, so cab + EQ are fully usable today independent of the model-file blocker. Live
  "Preview" button auditions cab + Input Gain + EQ on the loaded track in real time.

## In progress / blocked
- **Blocked on Brandon:** the amp model still isn't in `public/models/`. Two attempts so far have both
  been the wrong file type — first 3 uploaded `.exe` files (identical MD5 hashes despite 3 different
  names, almost certainly malware, refused), then a 60MB macOS `.pkg` (installer format, also not a NAM
  file — 60MB is nowhere near the size of a real `.nam`, refused). Waiting on: (a) whether any of the
  original `.exe`s were run, (b) the exact source URL, (c) confirmation of exactly which link/button on
  the tone page produces the actual `.nam` download. The real file:
  - Model: "MESA TRIPLE RECTIFIER" by deathblossomaudio, TRI-REC CH3 MODERN
  - https://www.tone3000.com/tones/mesa-triple-rectifier-41397
  - Grab both A2 and A1 (Legacy) if offered
  - Drop into `public/models/` per that folder's README
- **Blocked on API verification:** `src/lib/namEngine.js` has the integration point stubbed with TODOs.
  `neural-amp-modeler-wasm`'s documented exports (T3kPlayer, T3kPlayerContextProvider) look built for
  live preview, not offline whole-file rendering. Need to check the package's lower-level exports
  (node_modules/neural-amp-modeler-wasm/README + dist, or the GitHub repo's `ui/src/engine/`) once
  `npm install` has run, and wire `loadModel()` / `processBuffer()` to the real calls.

## Not started
- Multiple bundled models / model browsing UI
- Before/after preview player

## Open decision (needs Brandon, not just a build step)
"Find a tone" → describe-it mode is currently a static lookup table, so it only knows what we've manually
verified. Making it handle *any* band/description would mean wiring it to a live LLM call, which needs:
  - A backend function (Vercel serverless/edge) so an API key isn't exposed client-side
  - An actual API key (Anthropic or OpenAI) — an account + ongoing usage cost decision, not something to
    set up silently
Not building this until it's explicitly wanted — the static table + genre fallback covers the common
cases for free in the meantime.

## Completion criteria for "Phase 1 done"
- [ ] Upload a dry track, process through the Mesa Recto model, download a wet WAV that's audibly amped
- [ ] No console errors on a fresh `npm install && npm run dev`
- [ ] Deploys clean on Vercel from a push to `main`

## Next continuation prompt
"Check namEngine.js — I installed the package, here's what's in node_modules/neural-amp-modeler-wasm
[paste README or exports], wire up loadModel/processBuffer for real."
