import React from 'react';
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
    /** Whether the radio is selected */
    checked: boolean;
    /** Change handler */
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Value for the radio input */
    value: string;
    /** Name for the radio group */
    name: string;
    /** Optional label - when provided, clicking the label toggles the radio */
    label?: React.ReactNode;
    /** Additional class for the wrapper */
    className?: string;
}
/**
 * A radio button matching the design: selected = white inner dot with dark grey
 * ring; unselected = thin light grey outline, transparent interior.
 */
export declare const Radio: React.FC<RadioProps>;
