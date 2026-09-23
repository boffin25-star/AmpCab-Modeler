import React from 'react';
export interface ClipIndicatorProps {
    /** Click handler to reset the clip latch */
    onClick?: () => void;
    /** Size of the indicator in pixels */
    size?: number;
    /** Additional CSS classes */
    className?: string;
    /** Label for accessibility */
    label?: string;
    /** Whether the indicator is inactive */
    inactive?: boolean;
}
/**
 * A clip indicator that latches red when clipping is detected.
 *
 * The indicator turns red when the 'clipped' class is added (by useMeterAnimation).
 * Clicking it resets the latch.
 *
 * Usage:
 * ```tsx
 * const clipRef = useRef<HTMLButtonElement>(null);
 * const { resetClipLatch } = useMeterAnimation(
 *   { analyser, meterRef, clipRef },
 *   null,
 *   true
 * );
 * <ClipIndicator ref={clipRef} onClick={() => resetClipLatch('input')} />
 * ```
 */
export declare const ClipIndicator: React.ForwardRefExoticComponent<ClipIndicatorProps & React.RefAttributes<HTMLButtonElement>>;
