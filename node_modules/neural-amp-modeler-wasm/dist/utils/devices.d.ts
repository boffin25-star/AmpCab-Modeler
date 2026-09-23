/**
 * Map raw MediaDeviceInfo to simplified { deviceId, label } objects.
 * Provides a fallback label when the browser doesn't expose one.
 */
export declare function mapDevices(allDevices: MediaDeviceInfo[], kind: 'audioinput' | 'audiooutput'): Array<{
    deviceId: string;
    label: string;
}>;
