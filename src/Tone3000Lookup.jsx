import { useEffect, useState } from 'react';
import {
  startSelectFlow,
  isOAuthCallback,
  handleOAuthCallback,
  getTone,
  listModels,
  downloadModelAsFile,
} from './lib/tone3000';
import { addToLibrary } from './lib/library';

// Self-contained: render <Tone3000Lookup /> anywhere in the app. It
// doesn't depend on any other component's state, so it drops in
// regardless of how the surrounding UI is laid out.
export default function Tone3000Lookup() {
  const [status, setStatus] = useState('idle'); // idle | authorizing | loading | ready | error
  const [tone, setTone] = useState(null);
  const [models, setModels] = useState([]);
  const [error, setError] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    if (!isOAuthCallback()) return;
    (async () => {
      setStatus('authorizing');
      const result = await handleOAuthCallback();
      if (!result.ok) {
        if (result.canceled) {
          setStatus('idle');
          return;
        }
        setError(result.reason);
        setStatus('error');
        return;
      }
      if (!result.toneId) {
        setStatus('idle');
        return;
      }
      await loadTone(result.toneId);
    })();
  }, []);

  async function loadTone(toneId) {
    setStatus('loading');
    setError(null);
    try {
      const [toneData, modelsData] = await Promise.all([getTone(toneId), listModels(toneId)]);
      setTone(toneData);
      setModels(modelsData.data || []);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  async function handleAddModel(model) {
    if (!tone) return;
    setAddingId(model.id);
    setError(null);
    try {
      if (tone.format !== 'nam' && tone.format !== 'ir') {
        throw new Error(
          `This is a "${tone.format}" file — this app only supports .nam and .wav (IR) formats right now.`
        );
      }
      const file = await downloadModelAsFile(model, tone.format);
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      await addToLibrary(file, tone.format === 'ir' ? 'ir' : 'nam', audioCtx);
      setAddedIds((prev) => new Set(prev).add(model.id));
    } catch (err) {
      setError(err.message);
    }
    setAddingId(null);
  }

  return (
    <div className="tone3000-lookup rack-frame">
      <h2>Look up a tone on TONE3000</h2>
      <p className="subtitle">
        Search or browse TONE3000's own catalog directly (their real search, not ours) — pick a tone, come
        back here to pull its files straight into your library.
      </p>

      {status === 'idle' && <button onClick={() => startSelectFlow()}>Search TONE3000</button>}
      {status === 'authorizing' && <p className="meta">Signing you in…</p>}
      {status === 'loading' && <p className="meta">Loading tone…</p>}

      {status === 'error' && (
        <>
          <p className="error">{error}</p>
          <button onClick={() => startSelectFlow()}>Try again</button>
        </>
      )}

      {status === 'ready' && tone && (
        <div className="result">
          <strong>{tone.title}</strong>
          <p className="meta">
            by {tone.user?.display_name || tone.user?.username} · {tone.gear} ·{' '}
            {tone.format?.toUpperCase()}
          </p>
          {tone.description && <p>{tone.description}</p>}

          <ul className="library-list">
            {models.map((m) => (
              <li key={m.id}>
                {m.name}
                <button disabled={addingId === m.id || addedIds.has(m.id)} onClick={() => handleAddModel(m)}>
                  {addedIds.has(m.id) ? 'Added ✓' : addingId === m.id ? 'Adding…' : 'Add to Library'}
                </button>
              </li>
            ))}
          </ul>

          {error && <p className="error">{error}</p>}

          <button onClick={() => startSelectFlow()}>Search again</button>
        </div>
      )}
    </div>
  );
}
