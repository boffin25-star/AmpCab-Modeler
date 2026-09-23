/**
 * Audio metering utilities for real-time level calculation
 */
/** Threshold for clip detection (slightly below 1.0 to catch near-clips) */
export declare const CLIP_THRESHOLD = 0.99;
/** Meter level readings */
export interface MeterLevels {
    /** Peak level (0.0 to 1.0+, can exceed 1.0 if clipping) */
    peak: number;
    /** RMS level (0.0 to 1.0) */
    rms: number;
}
/**
 * Calculate peak and RMS levels from an AnalyserNode
 *
 * @param analyser - The AnalyserNode to read from
 * @param buffer - A reusable Float32Array buffer (should be analyser.fftSize length)
 * @returns Peak and RMS levels
 */
export declare function calculateLevels(analyser: AnalyserNode, buffer: Float32Array): MeterLevels;
/**
 * Convert linear amplitude to decibels
 *
 * @param linear - Linear amplitude (0.0 to 1.0+)
 * @returns Decibel value (-Infinity for silence)
 */
export declare function linearToDb(linear: number): number;
/**
 * Convert decibels to linear amplitude
 *
 * @param db - Decibel value
 * @returns Linear amplitude
 */
export declare function dbToLinear(db: number): number;
/**
 * Check if the given levels indicate clipping
 *
 * @param levels - Meter levels to check
 * @returns True if peak exceeds clip threshold
 */
export declare function isClipping(levels: MeterLevels): boolean;
/**
 * Clamp a value between min and max
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Map a linear level (0-1) to a display value with pseudo-logarithmic scaling
 * This makes the meter more visually responsive across the dynamic range
 *
 * @param level - Linear level (0.0 to 1.0)
 * @returns Scaled display value (0.0 to 1.0)
 */
export declare function scaleForDisplay(level: number): number;
/**
 * Map a linear level (0-1) to a pseudo-log display value (0-1) for block meters.
 * Uses dB scaling so blocks fill left-to-right in a log-like manner:
 * quiet levels fill fewer blocks, loud levels fill more, clipping = full bar.
 *
 * @param level - Linear level (0.0 to 1.0+)
 * @returns Display value 0.0 to 1.0
 */
export declare function levelToLogDisplay(level: number): number;
