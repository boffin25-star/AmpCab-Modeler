// toneShaper.js
//
// A NAM capture bakes in one fixed knob setting (whatever the creator
// captured) - it doesn't expose adjustable amp knobs. So "gain" and
// "bass/mid/treble" here are NOT the amp's internal tone stack. This is:
//   - Input Gain: turns the signal up/down before it hits the amp model,
//     which does change how hard a NAM model "sees" the signal
//   - Bass/Mid/Treble: a 3-band EQ applied AFTER the amp (+ cab, once
//     wired) - functionally an outboard EQ pedal at the end of the chain,
//     not the amp's own tone controls
//   - Output Gain: final trim before export
//
// Fully independent of the (still unwired) NAM engine - works on any
// AudioBuffer today.

const BASS_HZ = 120;
const MID_HZ = 800;
const MID_Q = 0.8;
const TREBLE_HZ = 3000;

export const DEFAULT_TONE_PARAMS = {
  inputGainDb: 0,
  bassDb: 0,
  midDb: 0,
  trebleDb: 0,
  outputGainDb: 0,
};

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

/**
 * Build the shared node chain (input gain -> bass -> mid -> treble ->
 * output gain) on whichever context you pass in (real-time AudioContext
 * for live preview, OfflineAudioContext for a render). Returns the input
 * node to connect your source to, and the output node to connect onward
 * (to `.destination` for preview, left dangling for the caller to route
 * during an offline render).
 */
export function buildToneChain(ctx, params = DEFAULT_TONE_PARAMS) {
  const inputGain = ctx.createGain();
  inputGain.gain.value = dbToGain(params.inputGainDb);

  const bass = ctx.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = BASS_HZ;
  bass.gain.value = params.bassDb;

  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = MID_HZ;
  mid.Q.value = MID_Q;
  mid.gain.value = params.midDb;

  const treble = ctx.createBiquadFilter();
  treble.type = 'highshelf';
  treble.frequency.value = TREBLE_HZ;
  treble.gain.value = params.trebleDb;

  const outputGain = ctx.createGain();
  outputGain.gain.value = dbToGain(params.outputGainDb);

  inputGain.connect(bass);
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(outputGain);

  return { input: inputGain, output: outputGain, nodes: { inputGain, bass, mid, treble, outputGain } };
}

/** Push new parameter values onto an already-built chain (for live tweaking). */
export function updateToneChain({ nodes }, params) {
  nodes.inputGain.gain.value = dbToGain(params.inputGainDb);
  nodes.bass.gain.value = params.bassDb;
  nodes.mid.gain.value = params.midDb;
  nodes.treble.gain.value = params.trebleDb;
  nodes.outputGain.gain.value = dbToGain(params.outputGainDb);
}

/** Render an AudioBuffer through the tone chain offline, returns a Promise<AudioBuffer>. */
export async function applyToneShapeOffline(audioBuffer, params = DEFAULT_TONE_PARAMS) {
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OfflineCtx(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const { input, output } = buildToneChain(ctx, params);
  source.connect(input);
  output.connect(ctx.destination);
  source.start(0);

  return ctx.startRendering();
}
