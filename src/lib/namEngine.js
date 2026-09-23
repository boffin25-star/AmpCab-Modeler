// namEngine.js
//
// Wraps `neural-amp-modeler-wasm` for OFFLINE processing: decode a full
// audio file, run it through a .nam model, return the wet buffer. No
// real-time constraint here since this is a reamp/render tool, not a
// live rig.
//
// STATUS: NOT YET WIRED UP. Here's why, so the next step is clear:
// `neural-amp-modeler-wasm` (github.com/tone-3000/neural-amp-modeler-wasm)
// ships React components (T3kPlayer, T3kPlayerContextProvider) built for
// browsing/previewing tones live - that's a different job than "decode this
// whole file, run it through the model, hand back a rendered buffer."
// There's very likely a lower-level engine export for that (the repo's
// wasm/ layer talks to NeuralAmpModelerCore directly), but I haven't
// confirmed the exact function names/signatures - the npm listing doesn't
// document them.
//
// NEXT STEP: after `npm install`, check:
//   - node_modules/neural-amp-modeler-wasm/README.md
//   - node_modules/neural-amp-modeler-wasm/dist/ (exported symbols)
//   - the repo's ui/src/engine/ source on GitHub
// and swap the two TODOs below for the real calls. Everything else in this
// app (upload, decode, UI, WAV export) works today and doesn't depend on
// this file being finished.

let modulePromise = null;

function getModule() {
  if (!modulePromise) {
    modulePromise = import('neural-amp-modeler-wasm');
  }
  return modulePromise;
}

/**
 * Load a .nam model from a URL (e.g. "/models/tri-rec-ch3-modern.nam").
 * Returns whatever handle the engine needs to run inference with it.
 */
export async function loadModel(modelUrl) {
  await getModule();
  // TODO: replace with the package's real model-loading call, e.g.
  //   const engine = await mod.createEngine();
  //   await engine.loadModel(modelUrl);
  //   return engine;
  throw new Error(
    `namEngine.loadModel() isn't wired up yet - see the STATUS comment ` +
      `at the top of src/lib/namEngine.js. Tried to load: ${modelUrl}`
  );
}

/**
 * Run a decoded AudioBuffer through the given model and return a new
 * AudioBuffer with the model applied. Mono in is fine; stereo in will be
 * processed per-channel.
 */
export async function processBuffer(audioBuffer, modelUrl) {
  const engine = await loadModel(modelUrl);

  // TODO: replace with the package's real per-channel processing call, e.g.
  //   const ctx = new OfflineAudioContext(
  //     audioBuffer.numberOfChannels,
  //     audioBuffer.length,
  //     audioBuffer.sampleRate
  //   );
  //   for each channel: engine.process(audioBuffer.getChannelData(c)) -> Float32Array
  //   write results into a new AudioBuffer and return it.

  throw new Error('namEngine.processBuffer() is not implemented yet.');
}
