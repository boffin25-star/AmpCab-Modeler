export declare const upperCaseFirst: (str: string) => string;
export declare const getExtension: (url: string) => string | undefined;
export declare function formatTime(time: number): string;
export declare function getDefault<T extends {
    default?: boolean;
}>(items: T[]): T;
