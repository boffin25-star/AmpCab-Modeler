// library.js
//
// Lets the user upload their own .nam (amp/pedal) and .wav (cabinet/space
// IR) files through the UI and have them persist across sessions - stored
// in this browser's IndexedDB. No backend involved.
//
// HONEST LIMITS - surface these in the UI, don't bury them:
//   - Local to THIS browser on THIS device. Doesn't sync to your phone,
//     doesn't back up anywhere, clearing browser data wipes it.
//   - .nam uploads (amps, pedals) get added to the library and become
//     selectable, but won't actually run until namEngine.js is wired to
//     the real inference engine - same bypass behavior as the bundled
//     model right now.
//   - .wav (IR) uploads work immediately - cabinet convolution is already
//     live, so an uploaded cab IR processes real audio today.
//
// If a real shared library (available on any device, to anyone) is ever
// wanted, that needs actual cloud storage (e.g. Vercel Blob) plus a small
// backend endpoint - a genuinely bigger step, not an extension of this
// file. Flag that as a decision, don't build it silently.

const DB_NAME = 'amp-cab-modeler';
const DB_VERSION = 1;
const STORE_NAME = 'library';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function labelFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

/** A real .nam file is JSON with at least these fields - catch obvious wrong files early. */
async function validateNamFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`"${file.name}" isn't valid JSON — a real .nam file is JSON. This doesn't look like one.`);
  }
  if (!data.architecture || !('weights' in data)) {
    throw new Error(
      `"${file.name}" is JSON but is missing fields a NAM file should have (architecture, weights). Wrong file?`
    );
  }
}

/** A real IR should decode as audio - catch obvious wrong files early. */
async function validateIRFile(file, audioCtx) {
  const arrayBuf = await file.arrayBuffer();
  try {
    await audioCtx.decodeAudioData(arrayBuf.slice(0));
  } catch {
    throw new Error(`"${file.name}" doesn't decode as audio — wrong file, or corrupted.`);
  }
}

/**
 * Add a user-uploaded file to the library. `type` is 'nam' or 'ir'.
 * Validates the file actually looks like what it claims before storing.
 * Throws with a user-facing message on failure.
 */
export async function addToLibrary(file, type, audioCtx) {
  if (type === 'nam') await validateNamFile(file);
  else if (type === 'ir') await validateIRFile(file, audioCtx);
  else throw new Error(`Unknown library item type: ${type}`);

  const item = {
    id: makeId(),
    type,
    label: labelFromFilename(file.name),
    filename: file.name,
    blob: file,
    addedAt: Date.now(),
  };

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return item;
}

/** List all library items of a given type, newest first. */
export async function listLibrary(type) {
  const db = await openDB();
  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return all.filter((i) => i.type === type).sort((a, b) => b.addedAt - a.addedAt);
}

/** Remove a library item by id. */
export async function removeFromLibrary(id) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/** Get a usable object URL for a stored item's blob - feeds straight into the existing loadModel/cabinet code. */
export function urlForItem(item) {
  return URL.createObjectURL(item.blob);
}
