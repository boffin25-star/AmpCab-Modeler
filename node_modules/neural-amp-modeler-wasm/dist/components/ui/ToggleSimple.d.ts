import React from 'react';
interface ToggleSimpleProps {
    isChecked: boolean;
    onChange: (isChecked: boolean) => void;
    disabled?: boolean;
    label: string;
    ariaLabel?: string;
}
export declare const ToggleSimple: ({ isChecked, onChange, disabled, label, ariaLabel, }: ToggleSimpleProps) => React.JSX.Element;
export {};
