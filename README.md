# Amp Cab Modeler

Reamp tool: upload a dry guitar track, run it through a NAM (Neural Amp
Modeler) amp/cab capture, download the wet render. Recording-only, no
real-time/live requirement.

## Stack
- React + Vite
- [`neural-amp-modeler-wasm`](https://github.com/tone-3000/neural-amp-modeler-wasm) for NAM A2/A1 inference
- Models sourced from [TONE3000](https://www.tone3000.com) (formerly ToneHunt)

## Setup
```
npm install
npm run dev
```

## Status
See `PROJECT_STATUS.md`.
