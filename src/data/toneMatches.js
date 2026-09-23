// toneMatches.js
//
// Curated example TONE3000 tones to point at based on the coarse
// character detected in toneAnalysis.js (band-energy + crest factor).
//
// IMPORTANT - what this is and isn't: a frequency/dynamics analysis of a
// finished (possibly full-mix) signal can tell you general character -
// bright/dark, saturated/clean, bass-heavy/not. It CANNOT tell you "this
// exact pedal + this exact amp + this exact cab were used" - that's gear
// fingerprinting, a much harder problem this technique doesn't attempt.
// So these are honest "closest style to try" suggestions, not a claim of
// identifying the source gear.
//
// Every link below was individually verified (page actually fetched/read)
// before being added here - don't add one on a guess.

export const TONE_MATCH_BUCKETS = {
  highGain: {
    label: 'High-gain / saturated',
    blurb:
      'Heavily compressed dynamics and a bass-forward balance point toward a modern high-gain rhythm tone.',
    links: [
      {
        label: 'Mesa Triple Rectifier — CH3 Modern (TS-9 boost)',
        url: 'https://www.tone3000.com/tones/mesa-triple-rectifier-41397',
      },
      {
        label: 'Triple Recto — Fortin 33 Boosted',
        url: 'https://www.tone3000.com/tones/triple-recto--27522',
      },
      {
        label: 'Mesa Triple Rectifier Rev G (1998, w/ OS 412)',
        url: 'https://www.tone3000.com/tones/mesa-triple-rectifier-rev-g-1998-w-os-412-79013',
      },
      {
        label: 'Cab: Mesa OS 4x12 IR',
        url: 'https://www.tone3000.com/tones/mesa-os-4x12-ir-1612',
      },
    ],
  },
  crunch: {
    label: 'Crunch / edge-of-breakup',
    blurb: "Moderate dynamics — not fully clean or fully saturated — sits in classic-rock crunch territory.",
    links: [
      {
        label: 'Marshall 1987X Capture Pack (40 captures, amp + cab + DI)',
        url: 'https://www.tone3000.com/tones/marshall-1987x-capture-pack-40-49137',
      },
    ],
  },
  clean: {
    label: 'Clean / low gain',
    blurb: 'Wide dynamic range with little saturation — points toward a clean or lightly-driven tone.',
    links: [
      {
        label: '65 Fender Princeton, various mics & gain stages',
        url: 'https://www.tone3000.com/tones/65-fender-princeton-with-various-mics-42319',
      },
    ],
  },
};

/** Pick one bucket from the raw analysis. Same crestDb thresholds as describeTone(). */
export function matchTonesFromAnalysis({ crestDb }) {
  if (crestDb < 10) return TONE_MATCH_BUCKETS.highGain;
  if (crestDb > 18) return TONE_MATCH_BUCKETS.clean;
  return TONE_MATCH_BUCKETS.crunch;
}
