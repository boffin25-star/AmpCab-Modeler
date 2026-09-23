import { useRef, useState } from 'react';
import { lookupTone } from './data/toneReferences';
import { analyzeAudioBuffer, describeTone } from './lib/toneAnalysis';

function TagLinks({ tags }) {
  return (
    <div className="tags">
      {tags.map((t) => (
        <a key={t} href={`https://www.tone3000.com/search?tags=${t}`} target="_blank" rel="noreferrer">
          {t}
        </a>
      ))}
      <a
        href={`https://www.tone3000.com/search?tags=${tags.join(',')}`}
        target="_blank"
        rel="noreferrer"
        className="tags-all"
      >
        Search all together →
      </a>
    </div>
  );
}

export default function ToneFinder() {
  const [mode, setMode] = useState('describe'); // 'describe' | 'upload'

  const [query, setQuery] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const audioCtxRef = useRef(null);

  function handleLookup(e) {
    e.preventDefault();
    setLookupResult(lookupTone(query));
  }

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
    setAnalysis(null);
    setError(null);
    setStatus('analyzing');
    try {
      const arrayBuf = await f.arrayBuffer();
      const decoded = await getAudioCtx().decodeAudioData(arrayBuf);
      const raw = analyzeAudioBuffer(decoded);
      const described = describeTone(raw);
      setAnalysis({ raw, described });
      setStatus('done');
    } catch (err) {
      setError(`Couldn't analyze that file: ${err.message}`);
      setStatus('idle');
    }
  }

  return (
    <div className="panel tone-finder">
      <h2>Find a tone</h2>
      <p className="subtitle">
        Describe a band or sound, or upload a reference track, and get a starting point for what to search
        on TONE3000.
      </p>

      <div className="tabs">
        <button className={mode === 'describe' ? 'tab active' : 'tab'} onClick={() => setMode('describe')}>
          Describe it
        </button>
        <button className={mode === 'upload' ? 'tab active' : 'tab'} onClick={() => setMode('upload')}>
          Upload a track
        </button>
      </div>

      {mode === 'describe' && (
        <form onSubmit={handleLookup} className="describe-form">
          <input
            type="text"
            placeholder="e.g. 'Bad Omens', 'djent', 'vintage clean'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Search</button>

          {lookupResult?.kind === 'band' && (
            <div className="result">
              <strong>{lookupResult.band}</strong>
              <p>{lookupResult.note}</p>
              <TagLinks tags={lookupResult.tags} />
            </div>
          )}

          {lookupResult?.kind === 'genre' && (
            <div className="result">
              <p>No specific band match — here's a starting point based on genre/character:</p>
              <TagLinks tags={lookupResult.tags} />
            </div>
          )}

          {lookupResult?.kind === 'none' && (
            <div className="result">
              <p>
                No match yet — this list only has bands we've actually verified gear for (right now: Bad
                Omens), plus generic genre keywords. Try a genre word (metal, djent, vintage, clean, blues,
                punk) instead, or we can grow this list over time.
              </p>
            </div>
          )}
        </form>
      )}

      {mode === 'upload' && (
        <div className="upload-analyze">
          <label className="upload">
            <input type="file" accept="audio/*" onChange={handleFile} />
            {file ? file.name : 'Choose a reference track'}
          </label>
          <p className="meta">
            Works best on an isolated guitar track. A full band mix reflects the whole mix — drums, bass,
            vocals and all — not just the guitar.
          </p>

          {status === 'analyzing' && <p>Analyzing…</p>}
          {error && <p className="error">{error}</p>}

          {analysis && (
            <div className="result">
              <p>
                {analysis.described.notes.length
                  ? analysis.described.notes.join(' · ')
                  : 'No strong characteristics detected — fairly balanced.'}
              </p>
              <details>
                <summary>Frequency balance</summary>
                <ul>
                  {Object.entries(analysis.raw.bandPercents).map(([band, pct]) => (
                    <li key={band}>
                      {band}: {pct.toFixed(1)}%
                    </li>
                  ))}
                </ul>
                <p>Crest factor: {analysis.raw.crestDb.toFixed(1)} dB</p>
              </details>
              {analysis.described.tags.length > 0 && <TagLinks tags={analysis.described.tags} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
