/**
 * Device identity for approvals.
 *
 * The service binds an approval to the device that signed it, so the PWA keeps
 * a non-extractable ECDSA P-256 key in IndexedDB and signs a canonical message
 * per decision (docs/device-key-contract.md). ES256 is used instead of Ed25519
 * because WebCrypto does not implement Ed25519 in all browsers.
 */

const DB_NAME = 'consent';
const STORE = 'device-keys';
const RECORD = 'signing-key';

export const DEVICE_KEY_ALG = 'es256';

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of view) s += String.fromCharCode(b);
  return btoa(s);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(key: string): Promise<T | null> {
  return openDB().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/** Load the device signing key, creating it on first use. */
export async function ensureDeviceKey(): Promise<CryptoKey | null> {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return null;
  try {
    const existing = await idbGet<CryptoKey>(RECORD);
    if (existing) return existing;
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, // private key never leaves the browser
      ['sign'],
    );
    await idbPut(RECORD, pair.privateKey);
    return pair.privateKey;
  } catch {
    // Private mode / storage denied: approvals fall back to unsigned, which the
    // server rejects only for policies that require a device-bound approval.
    return null;
  }
}

/** SPKI public key (base64) for registration. */
export async function devicePublicKey(): Promise<string> {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return '';
  const key = await ensureDeviceKey();
  if (!key) return '';
  try {
    const spki = await crypto.subtle.exportKey('spki', key);
    return b64(spki);
  } catch {
    return '';
  }
}

/** Same canonical string the service verifies. */
export function deviceSignedMessage(consentId: string, decision: string, paramsHash: string, signedAt: Date): string {
  const iso = signedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `consent-v1|${consentId}|${decision}|${paramsHash}|${iso}`;
}

export interface DeviceSignature {
  deviceSignedAt: string;
  deviceSignature: string;
}

/** Sign a decision with the device key; null when no key is available. */
export async function signDecision(
  consentId: string,
  decision: 'approved' | 'rejected',
  paramsHash: string,
): Promise<DeviceSignature | null> {
  const key = await ensureDeviceKey();
  if (!key) return null;
  const signedAt = new Date();
  try {
    const raw = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(deviceSignedMessage(consentId, decision, paramsHash ?? '', signedAt)),
    );
    return {
      // RFC3339 without fractional seconds, matching the server's parse.
      deviceSignedAt: signedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      deviceSignature: b64(raw),
    };
  } catch {
    return null;
  }
}
