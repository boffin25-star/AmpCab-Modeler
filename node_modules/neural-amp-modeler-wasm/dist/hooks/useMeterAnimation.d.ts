import { MeterLevels } from '../utils/metering';
/** Configuration for a single meter */
export interface MeterConfig {
    /** The AnalyserNode to read from */
    analyser: AnalyserNode | null;
    /** DOM element ref for the meter fill (will set --level CSS variable) */
    meterRef: React.RefObject<HTMLElement>;
    /** Optional: DOM element ref for clip indicator (will add/remove 'clipped' class) */
    clipRef?: React.RefObject<HTMLElement>;
}
/** State tracking for clip latching */
export interface ClipState {
    inputClipLatched: boolean;
    outputClipLatched: boolean;
}
/**
 * Hook for animating audio level meters at 60fps
 *
 * Uses direct DOM manipulation via CSS custom properties for performance.
 * Does NOT trigger React re-renders.
 *
 * @param inputConfig - Configuration for input meter
 * @param outputConfig - Configuration for output meter
 * @param enabled - Whether animation is running (default: true)
 * @returns Object with resetClipLatch function and current levels ref
 */
export declare function useMeterAnimation(inputConfig: MeterConfig | null, outputConfig: MeterConfig | null, enabled?: boolean): {
    /** Reset clip latch indicator(s) */
    resetClipLatch: (which?: "input" | "output" | "all") => void;
    /** Current meter levels (updated every frame, not reactive) */
    levelsRef: import("react").MutableRefObject<{
        input: MeterLevels;
        output: MeterLevels;
    }>;
    /** Current clip state (updated every frame, not reactive) */
    clipStateRef: import("react").MutableRefObject<ClipState>;
};
