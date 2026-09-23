# Models go here

## Cabinet IR — done
`Mesa_OS_4x12_57_m160.wav` is in place and wired into the app (App.jsx CABS
list → src/lib/cabinet.js). Mesa OS 4x12, SM57 + M160 mics, from TONE3000.

## Amp model — still needed
Drop the `.nam` file here once you have it, then add a matching entry to
the `MODELS` array in `src/App.jsx`.

Target: TONE3000 -> "MESA TRIPLE RECTIFIER" by deathblossomaudio
(TRI-REC CH3 MODERN) - https://www.tone3000.com/tones/mesa-triple-rectifier-41397
Download the A2 version if the engine supports it, A1 (Legacy) as fallback.
Save it here as:

    tri-rec-ch3-modern.nam

Two attempts so far have come back as the wrong file type (3 identical
`.exe`s, then a 60MB macOS `.pkg`) - neither is what a NAM file looks like
(small, `.nam`, JSON-based). Check exactly which link/button is being
clicked on the tone page before trying again.
