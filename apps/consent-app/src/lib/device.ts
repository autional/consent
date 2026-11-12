import { listDevices, registerDevice } from './api';
import { DEVICE_KEY_ALG, devicePublicKey } from './device_key';
import { isDemo } from './auth';

const DEVICE_KEY = 'consent.device_id';

export function getDeviceId(): string {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearDeviceId(): void {
  try {
    localStorage.removeItem(DEVICE_KEY);
  } catch {
    // ignore storage-disabled environments
  }
}

function deviceName(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
  return `PWA ${platform || 'web'}`.slice(0, 128);
}

let pending: Promise<string> | null = null;

/**
 * Best-effort device registration. The consent service binds the device to the
 * authenticated tenant/user and rejects revoked devices at decision time.
 *
 * The cached id is revalidated against the current user's device list so that
 * switching accounts/tenants does not reuse another user's device id. Failures
 * must not block the pending list; decisions without a device still work for
 * policies that do not require one.
 */
export async function ensureDevice(): Promise<string> {
  if (isDemo()) return '';
  if (pending) return pending;
  pending = (async () => {
    const existing = getDeviceId();
    if (existing) {
      try {
        const devices = await listDevices();
        if (devices.some((d) => d.id === existing && !d.revoked_at && d.public_key)) return existing;
      } catch {
        // Network/verifier issues: keep the cached id rather than blocking the UI.
        return existing;
      }
      clearDeviceId();
    }
    // Register the signing key too: without it the device cannot produce a
    // verifiable approval (policies that require a device would fail closed).
    const publicKey = await devicePublicKey();
    const device = await registerDevice({
      name: deviceName(),
      ...(publicKey ? { public_key: publicKey, key_alg: DEVICE_KEY_ALG } : {}),
    });
    try {
      localStorage.setItem(DEVICE_KEY, device.id);
    } catch {
      // Storage can be disabled; the in-memory return still lets this decision pass.
    }
    return device.id;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
