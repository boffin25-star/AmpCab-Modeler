// cabinet.js
//
// Cabinet impulse response (IR) convolution. An IR is just a short audio
// recording of a speaker/mic's response - convolving your signal with it
// is what makes a bare amp/DI signal sound like it came through a mic'd
// cabinet. The browser's native ConvolverNode does this; no library needed.

let irBufferCache = new Map();

/** Fetch + decode an IR wav file once, cache the decoded buffer by URL. */
export async function loadIR(ctx, url) {
  if (irBufferCache.has(url)) return irBufferCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load cabinet IR at ${url} (${res.status})`);
  const arrayBuf = await res.arrayBuffer();
  const decoded = await ctx.decodeAudioData(arrayBuf);
  irBufferCache.set(url, decoded);
  return decoded;
}

/** Build a ConvolverNode loaded with the given IR. Returns the node (input === output). */
export async function buildCabinetNode(ctx, irUrl) {
  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  convolver.buffer = await loadIR(ctx, irUrl);
  return convolver;
}

/** Render an AudioBuffer through a cabinet IR offline, returns Promise<AudioBuffer>. */
export async function applyCabinetOffline(audioBuffer, irUrl) {
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OfflineCtx(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const convolver = await buildCabinetNode(ctx, irUrl);
  source.connect(convolver);
  convolver.connect(ctx.destination);
  source.start(0);

  return ctx.startRendering();
}
