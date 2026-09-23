// chain.js
//
// Runs an ORDERED sequence of .nam captures (amp and/or pedal models) on a
// buffer, one after another - e.g. Compressor -> Delay -> Mesa Triple
// Rectifier, or the Rectifier with a delay stacked after it. Each slot
// references a library item (built-in or user-uploaded) by id; order is
// just the slots' array order, so reordering the UI list is all it takes
// to reorder the signal path.
//
// Each slot's processing goes through namEngine.processBuffer() - the
// exact same function the old single-model path used. Until that engine
// is wired to real inference, every slot bypasses to passthrough (same
// graceful-degradation behavior as the rest of the app) - this file
// doesn't need to change once namEngine is finished, it already calls
// the real function.

import { processBuffer } from './namEngine';

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Create a new chain slot referencing a library item by id. */
export function makeSlot(itemId) {
  return { id: makeId(), itemId, enabled: true };
}

/** Move a slot up or down in the chain array (returns a new array; doesn't mutate). */
export function moveSlot(slots, slotId, direction) {
  const index = slots.findIndex((s) => s.id === slotId);
  if (index === -1) return slots;
  const target = index + direction;
  if (target < 0 || target >= slots.length) return slots;
  const next = [...slots];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Toggle a slot's enabled/bypassed state (returns a new array; doesn't mutate). */
export function toggleSlot(slots, slotId) {
  return slots.map((s) => (s.id === slotId ? { ...s, enabled: !s.enabled } : s));
}

/** Remove a slot from the chain (returns a new array; doesn't mutate). */
export function removeSlot(slots, slotId) {
  return slots.filter((s) => s.id !== slotId);
}

/**
 * Run a buffer through an ordered chain of slots.
 *
 * `resolveItem(itemId)` looks up `{ url, label }` for a slot's itemId from
 * whichever combined list (built-in + uploaded) the caller currently has -
 * this module doesn't touch React state directly, so it works the same
 * regardless of how the UI is structured.
 *
 * Returns `{ buffer, bypassedCount }` - bypassedCount is how many enabled
 * slots fell back to passthrough (engine not wired yet, or a genuine
 * processing error), so the UI can show one honest combined notice
 * instead of one per slot.
 */
export async function runChain(audioBuffer, slots, resolveItem) {
  let current = audioBuffer;
  let bypassedCount = 0;

  for (const slot of slots) {
    if (!slot.enabled) continue;
    const item = resolveItem(slot.itemId);
    if (!item) continue; // slot points at a since-deleted library item - skip it

    try {
      current = await processBuffer(current, item.url);
    } catch (err) {
      bypassedCount += 1;
      // current is left as-is - this slot passes the signal through untouched
    }
  }

  return { buffer: current, bypassedCount };
}
