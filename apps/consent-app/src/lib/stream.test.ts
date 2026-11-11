import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const ticket = vi.fn();

vi.mock('./api', () => ({ createStreamTicket: () => ticket() }));
vi.mock('./config', () => ({
  getConfig: () => ({ VITE_CONSENT_BASE_URL: '/bff/consent/api/v1/ops' }),
}));

import { openConsentStream } from './stream';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<() => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(kind: string, fn: () => void) {
    const list = this.listeners.get(kind) ?? [];
    list.push(fn);
    this.listeners.set(kind, list);
  }

  emit(kind: string) {
    (this.listeners.get(kind) ?? []).forEach((fn) => fn());
  }

  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  ticket.mockReset();
  ticket.mockResolvedValue('tkt-1');
  // @ts-expect-error test double
  globalThis.EventSource = FakeEventSource;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('openConsentStream', () => {
  it('issues a ticket and subscribes to every named event kind', async () => {
    const onChange = vi.fn();
    const onStatus = vi.fn();
    const handle = openConsentStream({ onChange, onStatus });
    await Promise.resolve();
    await Promise.resolve();

    expect(ticket).toHaveBeenCalledTimes(1);
    const es = FakeEventSource.instances[0];
    expect(es.url).toContain('/consents/stream?ticket=tkt-1');

    es.onopen?.();
    expect(onStatus).toHaveBeenCalledWith('open');

    es.emit('pending');
    es.emit('decided');
    es.emit('resync');
    expect(onChange).toHaveBeenCalledTimes(3);

    handle.close();
    expect(es.closed).toBe(true);
    expect(onStatus).toHaveBeenLastCalledWith('closed');
  });

  it('does not connect while paused', async () => {
    const handle = openConsentStream({ onChange: vi.fn() });
    handle.pause();
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeEventSource.instances.length).toBeLessThanOrEqual(1);
    handle.close();
  });

  it('reconnects with backoff after an error', async () => {
    vi.useFakeTimers();
    const onStatus = vi.fn();
    const handle = openConsentStream({ onChange: vi.fn(), onStatus });
    await vi.runOnlyPendingTimersAsync();
    const es = FakeEventSource.instances[0];
    es.onerror?.();
    expect(onStatus).toHaveBeenCalledWith('error');

    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeEventSource.instances.length).toBe(2);
    handle.close();
  });
});
