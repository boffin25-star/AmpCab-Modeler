// namEngine.js
//
// Wraps `neural-amp-modeler-wasm`'s NamEngine/NamNode classes for OFFLINE
// processing: decode a full audio file, run it through a .nam model,
// return the wet buffer. No real-time constraint here since this is a
// reamp/render tool, not a live rig.
//
// Confirmed API, read directly from
// node_modules/neural-amp-modeler-wasm/dist/engine/NamEngine.d.ts:
//   NamEngine.attach(context: BaseAudioContext): Promise<NamEngine>
//     - one engine per AudioContext; fetches/registers the wasm module once
//   engine.createNode(): Promise<NamNode>
//     - cheap; every node shares the one wasm module the engine attached
//   node.loadModel(json: string): Promise<NamModelInfo>
//     - takes the raw .nam file's JSON text directly
//   node extends AudioWorkletNode - mono in, mono out - connects into any
//   Web Audio graph, including an OfflineAudioContext, exactly like any
//   other node.
//   node.dispose(): Promise<void>
//
// UNTESTED IN A REAL BROWSER - written against the .d.ts contract above,
// not run yet. If the render comes out silent, distorted in a way that
// isn't the amp, or throws, paste the exact error/behavior back and we'll
// adjust from what actually happens rather than the spec.
//
// KNOWN OPEN QUESTION: the .nam model here was captured at 48kHz. This
// renders at whatever sample rate the INPUT file already is. If those
// differ, the model's own math is rate-dependent, so the tone could come
// out subtly off (not resampled, just run at a different rate than it was
// trained for). Nothing in the type definitions says the engine handles
// that internally. If the reamped tone sounds wrong in a way that isn't
// "no processing happened," that mismatch is the first thing to check -
// don't guess a fix for it without confirming the symptom first.

import { NamEngine } from 'neural-amp-modeler-wasm';

const modelTextCache = new Map();

async function fetchModelJson(modelUrl) {
  if (modelTextCache.has(modelUrl)) return modelTextCache.get(modelUrl);
  const res = await fetch(modelUrl);
  if (!res.ok) {
    throw new Error(`Couldn't fetch model file at ${modelUrl} (${res.status})`);
  }
  const text = await res.text();
  modelTextCache.set(modelUrl, text);
  return text;
}

/**
 * Load a .nam model's raw JSON text from a URL. Cached per URL so
 * re-selecting the same model in the chain doesn't refetch it.
 */
export async function loadModel(modelUrl) {
  return fetchModelJson(modelUrl);
}

/**
 * Run a decoded AudioBuffer through the given .nam model and return a new
 * AudioBuffer with the model applied.
 *
 * One OfflineAudioContext per call (required - they're single-use and
 * sized to this specific buffer). One NamEngine.attach() per call too,
 * since the engine is tied to its context. For stereo input, each channel
 * gets its own NamNode instance off the SAME engine (NamNode is mono
 * in/mono out), split before and merged back after - not two separate
 * engines, so the wasm module itself only loads once even for stereo.
 */
export async function processBuffer(audioBuffer, modelUrl) {
  const modelJson = await fetchModelJson(modelUrl);
  const { numberOfChannels, length, sampleRate } = audioBuffer;

  const ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
  const engine = await NamEngine.attach(ctx);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const nodes = [];
  try {
    if (numberOfChannels === 1) {
      const node = await engine.createNode();
      await node.loadModel(modelJson);
      nodes.push(node);
      source.connect(node);
      node.connect(ctx.destination);
    } else {
      const splitter = ctx.createChannelSplitter(numberOfChannels);
      const merger = ctx.createChannelMerger(numberOfChannels);
      source.connect(splitter);
      for (let c = 0; c < numberOfChannels; c++) {
        const node = await engine.createNode();
        await node.loadModel(modelJson);
        nodes.push(node);
        splitter.connect(node, c);
        node.connect(merger, 0, c);
      }
      merger.connect(ctx.destination);
    }

    source.start(0);
    return await ctx.startRendering();
  } finally {
    await Promise.all(nodes.map((n) => n.dispose().catch(() => {})));
  }
}
