import { describe, expect, it } from 'vitest';
import { formatRemaining, riskLabel, shortHash, statusLabel } from './format';

describe('format', () => {
  it('labels risk levels', () => {
    expect(riskLabel('R0')).toBe('只读');
    expect(riskLabel('R2')).toBe('敏感');
    expect(riskLabel('R3')).toBe('破窗');
  });

  it('labels statuses', () => {
    expect(statusLabel('pending')).toBe('待确认');
    expect(statusLabel('approved')).toBe('已批准');
  });

  it('formats remaining time', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    expect(formatRemaining('2026-11-09T12:00:30Z', now)).toBe('30 秒');
    expect(formatRemaining('2026-11-09T12:05:00Z', now)).toBe('5 分钟');
    expect(formatRemaining('2026-11-09T10:00:00Z', now)).toBe('已过期');
    expect(formatRemaining(undefined, now)).toBe('—');
  });

  it('shortens hashes', () => {
    expect(shortHash('sha256:abcdefghijklmnopqrstuvwxyz')).toMatch(/…/);
    expect(shortHash(undefined)).toBe('—');
  });
});
