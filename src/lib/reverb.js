// reverb.js
//
// Honest label on this one: this is a SYNTHETIC/algorithmic reverb, not a
// captured real spring tank or room. It generates its impulse response
// programmatically (shaped white noise) rather than loading a real
// recording - the same core technique behind most basic algorithmic
// reverbs. That means it gives you genuine, adjustable ambience today
// with zero external file dependency, but it won't sound identical to a
// real Fender spring reverb or a real room capture. If you want that
// specific real character later, TONE3000 has actual captured spring/
// plate reverb pedal IRs - same pattern as the cab/space IRs: download,
// verify, wire in as a real file. This module would need swapping for
// that, not extending.

function makeSyntheticImpulseResponse(ctx, { durationSec = 2.2, decay = 2.5 } = {}) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * durationSec));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/**
 * Build a wet/dry reverb chain on the given context. `wetMix` is 0 (fully
 * dry) to 1 (fully wet). Returns {input, output, nodes} - same shape as
 * toneShaper's buildToneChain, so it slots into a signal chain the same
 * way.
 */
export function buildReverbChain(ctx, { wetMix = 0 } = {}) {
  const input = ctx.createGain();
  const output = ctx.createGain();

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - wetMix;

  const wetGain = ctx.createGain();
  wetGain.gain.value = wetMix;

  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  convolver.buffer = makeSyntheticImpulseResponse(ctx);

  input.connect(dryGain);
  dryGain.connect(output);

  input.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);

  return { input, output, nodes: { dryGain, wetGain, convolver } };
}

/** Push a new wet/dry mix onto an already-built chain (for live tweaking). */
export function updateReverbChain({ nodes }, { wetMix }) {
  nodes.dryGain.gain.value = 1 - wetMix;
  nodes.wetGain.gain.value = wetMix;
}

/** Render an AudioBuffer through the reverb offline, returns Promise<AudioBuffer>. */
export async function applyReverbOffline(audioBuffer, { wetMix = 0, tailSec = 2.2 } = {}) {
  if (wetMix <= 0) return audioBuffer; // skip entirely when off - no need to re-render
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  // Pad the render length so the reverb tail isn't cut off at the end of the track.
  const paddedLength = audioBuffer.length + Math.ceil(tailSec * audioBuffer.sampleRate);
  const ctx = new OfflineCtx(audioBuffer.numberOfChannels, paddedLength, audioBuffer.sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const { input, output } = buildReverbChain(ctx, { wetMix });
  source.connect(input);
  output.connect(ctx.destination);
  source.start(0);

  return ctx.startRendering();
}
