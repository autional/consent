import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerDevice } = vi.hoisted(() => ({ registerDevice: vi.fn(async () => ({ id: 'dev-1', name: 'PWA' })) }));

vi.mock('./api', () => ({ registerDevice }));
vi.mock('./auth', () => ({ isDemo: () => false }));

import { ensureDevice, getDeviceId } from './device';

describe('device registration', () => {
  beforeEach(() => {
    localStorage.clear();
    registerDevice.mockClear();
  });

  it('registers once and caches the id', async () => {
    await expect(ensureDevice()).resolves.toBe('dev-1');
    expect(getDeviceId()).toBe('dev-1');
    await expect(ensureDevice()).resolves.toBe('dev-1');
    expect(registerDevice).toHaveBeenCalledTimes(1);
  });
});
