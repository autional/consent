import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerDevice, listDevices, isDemo } = vi.hoisted(() => ({
  registerDevice: vi.fn(async () => ({ id: 'dev-2', name: 'PWA' })),
  listDevices: vi.fn(async () => [{ id: 'dev-1', name: 'PWA', revoked_at: null }]),
  isDemo: vi.fn(() => false),
}));

vi.mock('./api', () => ({ registerDevice, listDevices }));
vi.mock('./auth', () => ({ isDemo }));

import { clearDeviceId, ensureDevice, getDeviceId } from './device';

describe('device registration', () => {
  beforeEach(() => {
    localStorage.clear();
    registerDevice.mockClear();
    listDevices.mockClear();
    isDemo.mockReturnValue(false);
  });

  it('registers once and caches the id', async () => {
    listDevices.mockResolvedValueOnce([{ id: 'dev-2', name: 'PWA', revoked_at: null }]);
    await expect(ensureDevice()).resolves.toBe('dev-2');
    expect(getDeviceId()).toBe('dev-2');
    await expect(ensureDevice()).resolves.toBe('dev-2');
    expect(registerDevice).toHaveBeenCalledTimes(1);
    expect(registerDevice).toHaveBeenCalledWith(expect.stringMatching(/^PWA /));
  });

  it('reuses a device that still belongs to the current user', async () => {
    localStorage.setItem('consent.device_id', 'dev-1');
    await expect(ensureDevice()).resolves.toBe('dev-1');
    expect(registerDevice).not.toHaveBeenCalled();
    expect(listDevices).toHaveBeenCalledTimes(1);
  });

  it('re-registers when the cached id is missing from the current user device list', async () => {
    localStorage.setItem('consent.device_id', 'old-user-device');
    await expect(ensureDevice()).resolves.toBe('dev-2');
    expect(registerDevice).toHaveBeenCalledTimes(1);
  });

  it('does not register in demo mode', async () => {
    isDemo.mockReturnValue(true);
    await expect(ensureDevice()).resolves.toBe('');
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('clearDeviceId removes the cache', () => {
    localStorage.setItem('consent.device_id', 'dev-1');
    clearDeviceId();
    expect(getDeviceId()).toBe('');
  });
});
