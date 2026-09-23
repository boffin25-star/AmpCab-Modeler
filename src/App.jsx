import { useRef, useState } from 'react';
import { processBuffer } from './lib/namEngine';
import { applyCabinetOffline, buildCabinetNode } from './lib/cabinet';
import {
  DEFAULT_TONE_PARAMS,
  buildToneChain,
  updateToneChain,
  applyToneShapeOffline,
} from './lib/toneShaper';
import ToneFinder from './ToneFinder';

// Add an entry here for every .nam file you drop in public/models/.
const MODELS = [
  {
    id: 'tri-rec-ch3-modern',
    label: 'Mesa Triple Rectifier — CH3 Modern (TS-9 boost)',
    url: '/models/tri-rec-ch3-modern.nam',
  },
];

// Add an entry here for every cabinet IR you drop in public/models/.
const CABS = [
  {
    id: 'mesa-os-412-57-m160',
    label: 'Mesa OS 4x12 — SM57 + M160',
    url: '/models/Mesa_OS_4x12_57_m160.wav',
  },
];

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = buffer.length;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default function App() {
  const [file, setFile] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [modelId, setModelId] = useState(MODELS[0]?.id ?? '');
  const [cabId, setCabId] = useState(CABS[0]?.id ?? '');
  const [status, setStatus] = useState('idle'); // idle | decoding | ready | processing | done
  const [error, setError] = useState(null);
  const [wetBuffer, setWetBuffer] = useState(null);
  const [namBypassed, setNamBypassed] = useState(false);
  const [toneParams, setToneParams] = useState(DEFAULT_TONE_PARAMS);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioCtxRef = useRef(null);
  const previewChainRef = useRef(null);
  const previewSourceRef = useRef(null);

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setWetBuffer(null);
    setStatus('decoding');
    try {
      const arrayBuf = await f.arrayBuffer();
      const decoded = await getAudioCtx().decodeAudioData(arrayBuf);
      setAudioBuffer(decoded);
      setStatus('ready');
    } catch (err) {
      setError(`Couldn't decode that file: ${err.message}`);
      setStatus('idle');
    }
  }

  async function handleProcess() {
    if (!audioBuffer) return;
    setStatus('processing');
    setError(null);
    setNamBypassed(false);
    try {
      const model = MODELS.find((m) => m.id === modelId);
      const cab = CABS.find((c) => c.id === cabId);
      let namOut;
      try {
        namOut = await processBuffer(audioBuffer, model.url);
      } catch (namErr) {
        // Amp model isn't wired up yet (see namEngine.js) - fall back to
        // the dry signal so cab IR + tone-shaping are still usable today
        // instead of hard-failing the whole export.
        setNamBypassed(true);
        namOut = audioBuffer;
      }
      const cabbed = cab ? await applyCabinetOffline(namOut, cab.url) : namOut;
      const shaped = await applyToneShapeOffline(cabbed, toneParams);
      setWetBuffer(shaped);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('ready');
    }
  }

  function stopPreview() {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch {
        // already stopped
      }
      previewSourceRef.current.disconnect();
      previewSourceRef.current = null;
    }
    previewChainRef.current = null;
    setPreviewPlaying(false);
  }

  async function startPreview() {
    if (!audioBuffer) return;
    stopPreview();
    const ctx = getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    const cab = CABS.find((c) => c.id === cabId);
    const chain = buildToneChain(ctx, toneParams);
    if (cab) {
      const convolver = await buildCabinetNode(ctx, cab.url);
      source.connect(convolver);
      convolver.connect(chain.input);
    } else {
      source.connect(chain.input);
    }
    chain.output.connect(ctx.destination);
    source.onended = () => setPreviewPlaying(false);
    source.start(0);
    previewSourceRef.current = source;
    previewChainRef.current = chain;
    setPreviewPlaying(true);
  }

  function handleToneChange(key, value) {
    const next = { ...toneParams, [key]: value };
    setToneParams(next);
    if (previewChainRef.current) {
      updateToneChain(previewChainRef.current, next);
    }
  }

  function handleDownload() {
    if (!wetBuffer || !file) return;
    const blob = audioBufferToWav(wetBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^.]+$/, '')}-reamped.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <h1>Amp Cab Modeler</h1>
      <p className="subtitle">
        Upload a dry guitar track, run it through a NAM amp model, download the wet render.
      </p>

      <div className="panel">
        <label className="upload">
          <input type="file" accept="audio/*" onChange={handleFile} />
          {file ? file.name : 'Choose a WAV/audio file'}
        </label>

        {audioBuffer && (
          <p className="meta">
            {audioBuffer.numberOfChannels}ch · {audioBuffer.sampleRate}Hz ·{' '}
            {audioBuffer.duration.toFixed(1)}s
          </p>
        )}

        <label className="field">
          Model
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Cabinet IR
          <select value={cabId} onChange={(e) => setCabId(e.target.value)}>
            {CABS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="actions">
          <button disabled={!audioBuffer || status === 'processing'} onClick={handleProcess}>
            {status === 'processing' ? 'Processing…' : 'Process'}
          </button>
          <button disabled={!wetBuffer} onClick={handleDownload}>
            Download WAV
          </button>
        </div>

        {namBypassed && (
          <p className="notice">
            Amp model isn't wired up yet — this export is your dry track through the cabinet IR and
            tone-shaping EQ below, amp model skipped.
          </p>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <div className="panel tone-shape">
        <h2>Tone shape</h2>
        <p className="subtitle">
          Input gain feeds the amp model harder/softer. Bass/Mid/Treble is a 3-band EQ after the amp+cab —
          not the amp's own tone stack (a NAM capture is a fixed knob setting).
        </p>

        <ToneSlider
          label="Input Gain"
          value={toneParams.inputGainDb}
          min={-12}
          max={12}
          onChange={(v) => handleToneChange('inputGainDb', v)}
        />
        <ToneSlider
          label="Bass"
          value={toneParams.bassDb}
          min={-12}
          max={12}
          onChange={(v) => handleToneChange('bassDb', v)}
        />
        <ToneSlider
          label="Mid"
          value={toneParams.midDb}
          min={-12}
          max={12}
          onChange={(v) => handleToneChange('midDb', v)}
        />
        <ToneSlider
          label="Treble"
          value={toneParams.trebleDb}
          min={-12}
          max={12}
          onChange={(v) => handleToneChange('trebleDb', v)}
        />
        <ToneSlider
          label="Output Gain"
          value={toneParams.outputGainDb}
          min={-12}
          max={12}
          onChange={(v) => handleToneChange('outputGainDb', v)}
        />

        <button disabled={!audioBuffer} onClick={previewPlaying ? stopPreview : startPreview}>
          {previewPlaying ? 'Stop Preview' : 'Preview (dry + EQ)'}
        </button>
        <p className="meta">
          Preview plays your uploaded track live through the Cabinet IR + Input Gain + EQ so you can dial
          it in by ear — it doesn't include the amp model until that's wired up.
        </p>
      </div>

      <ToneFinder />
    </div>
  );
}

function ToneSlider({ label, value, min, max, onChange }) {
  return (
    <label className="tone-slider">
      <span>
        {label}: {value > 0 ? '+' : ''}
        {value} dB
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}
