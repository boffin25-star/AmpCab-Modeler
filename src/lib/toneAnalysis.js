// toneAnalysis.js
//
// Client-side, no-server audio analysis for the "upload a reference track"
// mode of the tone finder. This is the same technique used manually earlier
// on We_All_Carry_Something.wav (band-energy distribution + crest factor via
// a chunked FFT) - ported to JS so it runs in the browser instead of a
// Python sandbox.
//
// Caveat worth surfacing to the user in the UI: this measures whatever
// audio comes in. On a full band mix, that's drums/bass/vocals/guitar all
// together, not an isolated guitar tone. True source separation (isolating
// just the guitar from a mix) would need a much bigger addition - an
// in-browser ML model - and isn't part of this pass.

const FFT_SIZE = 4096;
const HOP = FFT_SIZE / 2;

const BANDS = [
  { name: 'sub-bass', lo: 20, hi: 80 },
  { name: 'bass', lo: 80, hi: 250 },
  { name: 'low-mid', lo: 250, hi: 500 },
  { name: 'mid', lo: 500, hi: 2000 },
  { name: 'upper-mid', lo: 2000, hi: 4000 },
  { name: 'presence', lo: 4000, hi: 8000 },
  { name: 'air', lo: 8000, hi: 20000 },
];

// Minimal iterative radix-2 Cooley-Tukey FFT, in place on same-length
// Float64Arrays. `n` must be a power of two.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curWr = 1;
      let curWi = 0;
      const half = len / 2;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * curWr - im[i + j + half] * curWi;
        const vIm = re[i + j + half] * curWi + im[i + j + half] * curWr;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextWr = curWr * wr - curWi * wi;
        const nextWi = curWr * wi + curWi * wr;
        curWr = nextWr;
        curWi = nextWi;
      }
    }
  }
}

function hannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/**
 * Analyze a decoded AudioBuffer: frequency-band energy distribution and
 * dynamics (crest factor). Mirrors the STFT-based approach used manually
 * in Python, at a coarser (but fast, dependency-free) resolution.
 */
export function analyzeAudioBuffer(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  const mono = new Float64Array(length);
  for (let c = 0; c < numChannels; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numChannels;
  }

  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const v = Math.abs(mono[i]);
    if (v > peak) peak = v;
    sumSquares += mono[i] * mono[i];
  }
  const rms = Math.sqrt(sumSquares / length);
  const crestDb = 20 * Math.log10((peak + 1e-12) / (rms + 1e-12));

  const window = hannWindow(FFT_SIZE);
  const numBins = FFT_SIZE / 2;
  const accum = new Float64Array(numBins);
  let numWindows = 0;

  for (let start = 0; start + FFT_SIZE <= length; start += HOP) {
    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) re[i] = mono[start + i] * window[i];
    fft(re, im);
    for (let b = 0; b < numBins; b++) accum[b] += re[b] * re[b] + im[b] * im[b];
    numWindows++;
  }

  const binHz = sampleRate / FFT_SIZE;
  let total = 0;
  for (let b = 0; b < numBins; b++) total += accum[b];

  const bandPercents = {};
  for (const band of BANDS) {
    let e = 0;
    const loBin = Math.floor(band.lo / binHz);
    const hiBin = Math.min(numBins, Math.ceil(band.hi / binHz));
    for (let b = loBin; b < hiBin; b++) e += accum[b];
    bandPercents[band.name] = total > 0 ? (100 * e) / total : 0;
  }

  return {
    durationSec: length / sampleRate,
    crestDb,
    bandPercents,
    numWindows,
  };
}

/** Turn the raw numbers into plain-language notes + starter tag suggestions. */
export function describeTone({ crestDb, bandPercents }) {
  const notes = [];
  const tags = new Set();

  const lowEnergy = bandPercents['sub-bass'] + bandPercents['bass'];
  const highEnergy = bandPercents['presence'] + bandPercents['air'];

  if (lowEnergy > 40) notes.push('bass-heavy / low-end forward');

  if (highEnergy < 10) {
    notes.push('dark, rolled-off top end');
  } else if (highEnergy > 20) {
    notes.push('bright, present top end');
    tags.add('bright');
  }

  if (crestDb < 10) {
    notes.push('heavily saturated / compressed dynamics — likely high gain or a hot mix bus');
    tags.add('high-gain');
  } else if (crestDb > 18) {
    notes.push('wide dynamic range — likely low gain or a clean/lightly-driven tone');
    tags.add('clean');
  }

  return { notes, tags: [...tags] };
}
