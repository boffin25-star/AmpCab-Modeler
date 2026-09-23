// toneReferences.js
//
// IMPORTANT: only add a BAND_REFERENCES entry once it's actually been
// researched (interviews, gear-site sourcing, etc.) - no guessed gear
// claims. Right now that's just Bad Omens, from the session where we
// looked it up. Everything else falls through to the generic genre
// keyword matching below, which makes no artist-specific claims.

export const BAND_REFERENCES = [
  {
    match: ['bad omens'],
    band: 'Bad Omens',
    note:
      "Guitarist Joakim Karlsson runs a Kemper profile of a Mesa Boogie Triple Rectifier live, " +
      "and has used Neural DSP's Archetype: Gojira plugin for studio tracking. Target the " +
      'tighter, boosted "modern channel" Recto voicing, not vintage scooped nu-metal.',
    tags: ['mesa-boogie-triple-rectifier', 'high-gain', 'modern-metal', 'djent', 'tight-metal'],
  },
];

// Generic genre/character keywords - safe fallback, not tied to any
// specific artist's actual gear.
export const GENRE_KEYWORDS = [
  {
    match: ['djent', 'metalcore', 'modern metal'],
    tags: ['high-gain', 'modern-metal', 'djent', 'tight-metal'],
  },
  {
    match: ['deathcore', 'death metal'],
    tags: ['high-gain', 'metal', 'tight-metal', 'mesa-boogie-triple-rectifier'],
  },
  {
    match: ['nu metal', 'numetal', 'nu-metal'],
    tags: ['mesa-boogie-triple-rectifier', 'high-gain', 'rock'],
  },
  {
    match: ['classic rock', 'vintage', 'plexi', 'hard rock'],
    tags: ['marshall', 'crunch', 'vintage', 'rock'],
  },
  {
    match: ['clean', 'ambient', 'shoegaze'],
    tags: ['fender', 'clean', 'ambient'],
  },
  {
    match: ['blues'],
    tags: ['fender', 'tweed', 'crunch', 'blues'],
  },
  {
    match: ['punk', 'hardcore'],
    tags: ['marshall', 'high-gain', 'rock'],
  },
];

export function lookupTone(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const bandHit = BAND_REFERENCES.find((b) => b.match.some((m) => q.includes(m)));
  if (bandHit) return { kind: 'band', ...bandHit };

  const genreHits = GENRE_KEYWORDS.filter((g) => g.match.some((m) => q.includes(m)));
  if (genreHits.length) {
    const tags = [...new Set(genreHits.flatMap((g) => g.tags))];
    return { kind: 'genre', tags };
  }

  return { kind: 'none' };
}
