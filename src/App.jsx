import { useEffect, useRef, useState } from 'react';
import { processBuffer } from './lib/namEngine';
import { applyCabinetOffline, buildCabinetNode } from './lib/cabinet';
import { addToLibrary, listLibrary, removeFromLibrary, urlForItem } from './lib/library';
import {
  DEFAULT_TONE_PARAMS,
  buildToneChain,
  updateToneChain,
  applyToneShapeOffline,
} from './lib/toneShaper';
import { buildReverbChain, updateReverbChain, applyReverbOffline } from './lib/reverb';
import { makeSlot, toggleSlot, removeSlot, runChain } from './lib/chain';
import ToneFinder from './ToneFinder';
import Tone3000Lookup from './Tone3000Lookup';

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
  view.setUint16(20, 1, true);
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
  // chainSlots[0] is always "the amp" (shown in the hero panel below, never
  // removed). chainSlots.slice(1) are pedals stacked AFTER the amp - add,
  // remove, reorder, bypass freely. Order in the array = signal order.
  const [chainSlots, setChainSlots] = useState(() => [makeSlot(MODELS[0]?.id ?? '')]);
  const [cabId, setCabId] = useState(CABS[0]?.id ?? '');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [wetBuffer, setWetBuffer] = useState(null);
  const [bypassedCount, setBypassedCount] = useState(0);
  const [toneParams, setToneParams] = useState(DEFAULT_TONE_PARAMS);
  const [reverbMix, setReverbMix] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [customModels, setCustomModels] = useState([]);
  const [customCabs, setCustomCabs] = useState([]);
  const [libraryError, setLibraryError] = useState(null);
  const audioCtxRef = useRef(null);
  const previewChainRef = useRef(null);
  const previewReverbRef = useRef(null);
  const previewSourceRef = useRef(null);

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  async function refreshLibrary() {
    const [nams, irs] = await Promise.all([listLibrary('nam'), listLibrary('ir')]);
    setCustomModels(nams.map((item) => ({ ...item, url: urlForItem(item) })));
    setCustomCabs(irs.map((item) => ({ ...item, url: urlForItem(item) })));
  }

  useEffect(() => {
    refreshLibrary();
  }, []);

  // Built-in bundled files + anything uploaded, combined into one list.
  const allModels = [
    ...MODELS,
    ...customModels.map((m) => ({ id: m.id, label: `${m.label} (uploaded)`, url: m.url })),
  ];
  const allCabs = [
    ...CABS,
    ...customCabs.map((c) => ({ id: c.id, label: `${c.label} (uploaded)`, url: c.url })),
  ];

  function resolveItem(itemId) {
    return allModels.find((m) => m.id === itemId) || null;
  }

  async function handleUploadModel(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLibraryError(null);
    try {
      await addToLibrary(f, 'nam', getAudioCtx());
      await refreshLibrary();
    } catch (err) {
      setLibraryError(err.message);
    }
    e.target.value = '';
  }

  async function handleUploadCab(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLibraryError(null);
    try {
      const item = await addToLibrary(f, 'ir', getAudioCtx());
      await refreshLibrary();
      setCabId(item.id);
    } catch (err) {
      setLibraryError(err.message);
    }
    e.target.value = '';
  }

  async function handleRemoveModel(id) {
    await removeFromLibrary(id);
    await refreshLibrary();
    setChainSlots((prev) => prev.map((s) => (s.itemId === id ? { ...s, itemId: MODELS[0]?.id ?? '' } : s)));
  }

  async function handleRemoveCab(id) {
    await removeFromLibrary(id);
    await refreshLibrary();
    if (cabId === id) setCabId(CABS[0]?.id ?? '');
  }

  function handleAmpChange(itemId) {
    setChainSlots((prev) => {
      const next = [...prev];
      next[0] = { ...next[0], itemId };
      return next;
    });
  }

  function handleAddPedal() {
    setChainSlots((prev) => [...prev, makeSlot(allModels[0]?.id ?? '')]);
  }

  function handlePedalItemChange(slotId, itemId) {
    setChainSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, itemId } : s)));
  }

  function handlePedalToggle(slotId) {
    setChainSlots((prev) => toggleSlot(prev, slotId));
  }

  function handlePedalRemove(slotId) {
    setChainSlots((prev) => removeSlot(prev, slotId));
  }

  function handlePedalMove(slotId, direction) {
    setChainSlots((prev) => {
      const index = prev.findIndex((s) => s.id === slotId);
      if (index <= 0) return prev; // never touches slot 0 (the amp)
      const target = index + direction;
      if (target < 1 || target >= prev.length) return prev; // stays within the pedal range
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
    setBypassedCount(0);
    try {
      const cab = allCabs.find((c) => c.id === cabId);
      const { buffer: chained, bypassedCount: bypassed } = await runChain(audioBuffer, chainSlots, resolveItem);
      setBypassedCount(bypassed);
      const cabbed = cab ? await applyCabinetOffline(chained, cab.url) : chained;
      const shaped = await applyToneShapeOffline(cabbed, toneParams);
      const reverbed = await applyReverbOffline(shaped, { wetMix: reverbMix });
      setWetBuffer(reverbed);
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
    previewReverbRef.current = null;
    setPreviewPlaying(false);
  }

  async function startPreview() {
    if (!audioBuffer) return;
    stopPreview();
    const ctx = getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    const cab = allCabs.find((c) => c.id === cabId);
    const chain = buildToneChain(ctx, toneParams);
    const reverbChain = buildReverbChain(ctx, { wetMix: reverbMix });
    if (cab) {
      const convolver = await buildCabinetNode(ctx, cab.url);
      source.connect(convolver);
      convolver.connect(chain.input);
    } else {
      source.connect(chain.input);
    }
    chain.output.connect(reverbChain.input);
    reverbChain.output.connect(ctx.destination);
    source.onended = () => setPreviewPlaying(false);
    source.start(0);
    previewSourceRef.current = source;
    previewChainRef.current = chain;
    previewReverbRef.current = reverbChain;
    setPreviewPlaying(true);
  }

  function handleToneChange(key, value) {
    const next = { ...toneParams, [key]: value };
    setToneParams(next);
    if (previewChainRef.current) {
      updateToneChain(previewChainRef.current, next);
    }
  }

  function handleReverbChange(value) {
    setReverbMix(value);
    if (previewReverbRef.current) {
      updateReverbChain(previewReverbRef.current, { wetMix: value });
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

  const ampItem = resolveItem(chainSlots[0]?.itemId);
  const selectedCab = allCabs.find((c) => c.id === cabId);
  const pedalSlots = chainSlots.slice(1);

  return (
    <div className="app-shell">
      <header className="topbar rack-frame">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <h1>AmpCab Modeler</h1>
            <p>REAMP · TONE MATCH · RECORD</p>
          </div>
        </div>
        <div className="engine-pill">
          <span className="status-led" />
          <div>
            <strong>{status === 'processing' ? 'Processing' : 'Engine Ready'}</strong>
            <small>NAM + cabinet workflow</small>
          </div>
        </div>
      </header>

      <main className="studio-rack">
        <section className="track-panel rack-frame">
          <div className="section-kicker">GUITAR TRACK · DI</div>
          <div className="track-grid">
            <label className="upload upload-compact">
              <input type="file" accept="audio/*" onChange={handleFile} />
              <span className="file-icon">▣</span>
              <span>
                <strong>{file ? file.name : 'Choose a WAV / audio file'}</strong>
                <small>{file ? 'Tap to replace track' : 'Dry guitar input'}</small>
              </span>
            </label>

            <div className="waveform" aria-hidden="true">
              <div className="wave-bars">
                {Array.from({ length: 72 }).map((_, i) => (
                  <i key={i} style={{ '--h': `${18 + ((i * 17) % 64)}%` }} />
                ))}
              </div>
              <div className="wave-playhead" />
              <span className="wave-label">{audioBuffer ? `${audioBuffer.duration.toFixed(1)}s` : 'NO TRACK'}</span>
            </div>

            <button
              className="transport-button"
              disabled={!audioBuffer}
              onClick={previewPlaying ? stopPreview : startPreview}
              aria-label={previewPlaying ? 'Stop preview' : 'Start preview'}
            >
              {previewPlaying ? '■' : '▶'}
            </button>
          </div>
          {audioBuffer && (
            <p className="track-meta">
              {audioBuffer.numberOfChannels}ch · {audioBuffer.sampleRate} Hz · {audioBuffer.duration.toFixed(1)} sec
            </p>
          )}
        </section>

        <section className="signal-panel rack-frame">
          <div className="section-kicker">SIGNAL CHAIN</div>
          <div className="signal-chain">
            {['DI', 'BOOST', 'AMP', 'CAB', 'EQ', 'OUTPUT'].map((item, index) => (
              <div className="signal-step" key={item}>
                <span className={`chain-led chain-led-${index}`} />
                <strong>{item}</strong>
                {index < 5 && <b>›</b>}
              </div>
            ))}
          </div>
        </section>

        <div className="gear-grid">
          <section className="amp-panel rack-frame">
            <div className="amp-topline">
              <span>AMP · HIGH-GAIN MODERN</span>
              <span className="target-badge">BAD OMENS TARGET</span>
            </div>
            <div className="amp-face">
              <div className="amp-grille">
                <div className="amp-nameplate">
                  <small>NEURAL AMP MODEL</small>
                  <strong>{ampItem?.label?.split('—')[0]?.trim() || 'No capture loaded'}</strong>
                  <span>TONE3000 NAM CAPTURE</span>
                </div>
              </div>
              <div className="amp-controls">
                <div className="power-switch"><span />ON</div>
                <KnobDisplay label="INPUT" value={toneParams.inputGainDb} suffix=" dB" />
                <KnobDisplay label="BASS" value={toneParams.bassDb} suffix=" dB" />
                <KnobDisplay label="MID" value={toneParams.midDb} suffix=" dB" />
                <KnobDisplay label="TREBLE" value={toneParams.trebleDb} suffix=" dB" />
                <KnobDisplay label="OUTPUT" value={toneParams.outputGainDb} suffix=" dB" />
                <div className="amp-vents" aria-hidden="true">
                  {Array.from({ length: 7 }).map((_, i) => <i key={i} />)}
                </div>
              </div>
            </div>

            <label className="field model-selector">
              <span>Loaded capture</span>
              <select value={chainSlots[0]?.itemId ?? ''} onChange={(e) => handleAmpChange(e.target.value)}>
                {allModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>

            <div className="chain-panel">
              <div className="section-kicker">PEDALS AFTER THE AMP</div>
              {pedalSlots.length === 0 && (
                <p className="meta">No pedals in the chain yet — add a delay, compressor, boost, etc.</p>
              )}
              {pedalSlots.map((slot, i) => (
                <div className={`chain-slot${slot.enabled ? '' : ' disabled'}`} key={slot.id}>
                  <select value={slot.itemId} onChange={(e) => handlePedalItemChange(slot.id, e.target.value)}>
                    {allModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <div className="chain-slot-actions">
                    <button className="chain-btn" onClick={() => handlePedalMove(slot.id, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button className="chain-btn" onClick={() => handlePedalMove(slot.id, 1)} disabled={i === pedalSlots.length - 1} aria-label="Move down">↓</button>
                    <button className="chain-btn" onClick={() => handlePedalToggle(slot.id)}>{slot.enabled ? 'On' : 'Bypassed'}</button>
                    <button className="remove-btn" onClick={() => handlePedalRemove(slot.id)}>Remove</button>
                  </div>
                </div>
              ))}
              <button className="chain-btn" onClick={handleAddPedal}>+ Add pedal to chain</button>

              <label className="upload upload-small" style={{ marginTop: 10 }}>
                <input type="file" accept=".nam" onChange={handleUploadModel} />
                + Upload your own .nam file (amp or pedal)
              </label>
              {customModels.length > 0 && (
                <ul className="library-list">
                  {customModels.map((m) => (
                    <li key={m.id}>
                      {m.label}
                      <button className="remove-btn" onClick={() => handleRemoveModel(m.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              {libraryError && <p className="error">{libraryError}</p>}
              <p className="meta" style={{ marginTop: 8 }}>
                Uploads are saved in this browser only. .nam uploads become selectable but won't process
                audio until the amp engine is wired up.
              </p>
            </div>
          </section>

          <section className="cab-panel rack-frame">
            <div className="section-kicker">CABINET</div>
            <div className="cab-visual">
              <div className="cab-nameplate">MESA OVERSIZED 4×12</div>
              <div className="speaker-grid">
                <span /><span /><span /><span />
              </div>
              <div className="mic-pair">
                <div><i className="mic mic-57" /><strong>SM57</strong><small>ON AXIS</small></div>
                <div><i className="mic mic-160" /><strong>M160</strong><small>BLEND</small></div>
              </div>
            </div>
            <label className="field cab-selector">
              <span>Loaded IR</span>
              <select value={cabId} onChange={(e) => setCabId(e.target.value)}>
                {allCabs.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <div className="cab-spec">
              <span>Cab</span><strong>{selectedCab?.label || 'None'}</strong>
            </div>

            <label className="upload upload-small" style={{ marginTop: 10 }}>
              <input type="file" accept=".wav" onChange={handleUploadCab} />
              + Upload your own cabinet/space IR (.wav)
            </label>
            {customCabs.length > 0 && (
              <ul className="library-list">
                {customCabs.map((c) => (
                  <li key={c.id}>
                    {c.label}
                    <button className="remove-btn" onClick={() => handleRemoveCab(c.id)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="tone-shape rack-frame">
          <div className="section-title-row">
            <div>
              <div className="section-kicker">POST EQ / LEVEL / VERB</div>
              <h2>Tone Shaper</h2>
            </div>
            <p>These controls shape the signal around the fixed NAM capture(s).</p>
          </div>

          <div className="knob-row">
            <ToneSlider label="Input" value={toneParams.inputGainDb} min={-12} max={12} onChange={(v) => handleToneChange('inputGainDb', v)} />
            <ToneSlider label="Depth" value={toneParams.depthDb} min={-12} max={12} onChange={(v) => handleToneChange('depthDb', v)} />
            <ToneSlider label="Bass" value={toneParams.bassDb} min={-12} max={12} onChange={(v) => handleToneChange('bassDb', v)} />
            <ToneSlider label="Mid" value={toneParams.midDb} min={-12} max={12} onChange={(v) => handleToneChange('midDb', v)} />
            <ToneSlider label="Treble" value={toneParams.trebleDb} min={-12} max={12} onChange={(v) => handleToneChange('trebleDb', v)} />
            <ToneSlider label="Presence" value={toneParams.presenceDb} min={-12} max={12} onChange={(v) => handleToneChange('presenceDb', v)} />
            <ToneSlider label="Output" value={toneParams.outputGainDb} min={-12} max={12} onChange={(v) => handleToneChange('outputGainDb', v)} />
            <ToneSlider label="Reverb" value={Math.round(reverbMix * 100)} min={0} max={100} suffix="%" onChange={(v) => handleReverbChange(v / 100)} />
          </div>
          <p className="meta" style={{ marginTop: 10 }}>
            Reverb is synthetic/algorithmic, not a captured real spring tank or room.
          </p>
        </section>

        <ToneFinder />
        <Tone3000Lookup />

        {bypassedCount > 0 && (
          <div className="notice rack-frame">
            {bypassedCount} chain stage{bypassedCount > 1 ? 's are' : ' is'} currently bypassed by the engine
            (not wired up yet). This render used the cabinet IR and tone-shaping stage only for those.
          </div>
        )}
        {error && <p className="error rack-frame">{error}</p>}

        <section className="bottom-actions rack-frame">
          <div className="preset-readout">
            <small>ACTIVE RIG</small>
            <strong>{ampItem?.label || 'No model selected'}{pedalSlots.length > 0 ? ` +${pedalSlots.length}` : ''}</strong>
          </div>
          <button className="secondary-action" disabled={!audioBuffer} onClick={previewPlaying ? stopPreview : startPreview}>
            {previewPlaying ? 'STOP PREVIEW' : 'PREVIEW CHAIN'}
          </button>
          <button className="primary-action" disabled={!audioBuffer || status === 'processing'} onClick={handleProcess}>
            {status === 'processing' ? 'PROCESSING…' : 'PROCESS / REAMP'}
          </button>
          <button className="secondary-action" disabled={!wetBuffer} onClick={handleDownload}>
            DOWNLOAD WAV
          </button>
        </section>
      </main>
    </div>
  );
}

function KnobDisplay({ label, value, suffix = '' }) {
  const normalized = Math.max(-12, Math.min(12, Number(value) || 0));
  const rotation = -135 + ((normalized + 12) / 24) * 270;
  return (
    <div className="knob-display">
      <div className="knob-shell" style={{ '--rotation': `${rotation}deg` }}>
        <span />
      </div>
      <strong>{label}</strong>
      <small>{value > 0 ? '+' : ''}{value}{suffix}</small>
    </div>
  );
}

function ToneSlider({ label, value, min, max, onChange, suffix = ' dB' }) {
  const rotation = -135 + ((value - min) / (max - min)) * 270;
  const step = suffix === '%' ? 1 : 0.5;
  return (
    <label className="tone-knob">
      <span className="tone-knob-label">{label}</span>
      <span className="knob-shell interactive" style={{ '--rotation': `${rotation}deg` }}>
        <span />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={label}
        />
      </span>
      <strong>{value > 0 && suffix !== '%' ? '+' : ''}{value}{suffix}</strong>
    </label>
  );
}
