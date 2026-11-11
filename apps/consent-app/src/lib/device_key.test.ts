import { describe, expect, it } from 'vitest';
import { deviceSignedMessage } from './device_key';

describe('deviceSignedMessage', () => {
  it('matches the server canonical form (RFC3339 without fractional seconds)', () => {
    const at = new Date('2026-11-11T08:30:00.123Z');
    expect(deviceSignedMessage('c1', 'approved', 'sha256:v1:abc', at)).toBe(
      'consent-v1|c1|approved|sha256:v1:abc|2026-11-11T08:30:00Z',
    );
  });

  it('keeps field order stable and tolerates an empty params hash', () => {
    const at = new Date('2026-11-11T08:30:00.000Z');
    expect(deviceSignedMessage('c2', 'rejected', '', at)).toBe(
      'consent-v1|c2|rejected||2026-11-11T08:30:00Z',
    );
  });
});
