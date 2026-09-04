import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'android' | 'ios';

export function getPlatform(): Platform {
  return Capacitor.getPlatform() as Platform;
}

export function isNativeAndroid(): boolean {
  return getPlatform() === 'android';
}
