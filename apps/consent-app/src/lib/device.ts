import { registerDevice } from './api';
import { isDemo } from './auth';

const DEVICE_KEY = 'consent.device_id';

export function getDeviceId(): string {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? '';
  } catch {
    return '';
  }
}

function deviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const name = `PWA ${ua}`.trim();
  return name.slice(0, 128);
}

/**
 * Best-effort device registration. The consent service binds the device to the
 * authenticated tenant/user and rejects revoked devices at decision time.
 * Failures must not block the pending list; decisions without a device still
 * work for policies that do not require one.
 */
export async function ensureDevice(): Promise<string> {
  if (isDemo()) return '';
  const existing = getDeviceId();
  if (existing) return existing;
  const device = await registerDevice(deviceName());
  try {
    localStorage.setItem(DEVICE_KEY, device.id);
  } catch {
    // Storage can be disabled; the in-memory return still lets this decision pass.
  }
  return device.id;
}
