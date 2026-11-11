import { createStreamTicket } from './api';
import { getConfig } from './config';

export type StreamStatus = 'connecting' | 'open' | 'error' | 'closed';

export interface StreamHandle {
  close(): void;
  pause(): void;
  resume(): void;
}

const EVENT_KINDS = ['pending', 'decided', 'canceled', 'resync'];

function streamURL(): string {
  const base = getConfig().VITE_CONSENT_BASE_URL || '/bff/ops/v1';
  return `${base}/consents/stream`;
}

/**
 * Live-update channel.
 *
 * Contract: every event is only a "something changed" signal — callers must
 * refetch the list instead of trusting the payload, so a dropped or reordered
 * event can never leave stale state on screen.
 *
 * Reconnect uses exponential backoff (1s → 30s) like the authenticator portal.
 * Pausing on a hidden tab avoids holding a connection the OS may have frozen.
 */
export function openConsentStream(opts: {
  onChange: () => void;
  onStatus?: (s: StreamStatus) => void;
}): StreamHandle {
  let closed = false;
  let paused = false;
  let es: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retry = 0;

  const schedule = () => {
    if (closed || paused) return;
    const delay = Math.min(30_000, 1_000 * 2 ** retry);
    retry += 1;
    timer = setTimeout(() => void connect(), delay);
  };

  const teardown = () => {
    if (es) {
      es.close();
      es = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const connect = async () => {
    if (closed || paused) return;
    teardown();
    opts.onStatus?.('connecting');
    try {
      const ticket = await createStreamTicket();
      if (closed || paused) return;
      es = new EventSource(`${streamURL()}?ticket=${encodeURIComponent(ticket)}`);
      es.onopen = () => {
        retry = 0;
        opts.onStatus?.('open');
      };
      // Named SSE events do not reach onmessage; subscribe to each kind.
      for (const kind of EVENT_KINDS) {
        es.addEventListener(kind, () => opts.onChange());
      }
      es.onmessage = () => opts.onChange();
      es.onerror = () => {
        teardown();
        opts.onStatus?.('error');
        schedule();
      };
    } catch {
      opts.onStatus?.('error');
      schedule();
    }
  };

  void connect();

  return {
    close() {
      closed = true;
      teardown();
      opts.onStatus?.('closed');
    },
    pause() {
      paused = true;
      teardown();
    },
    resume() {
      if (closed || !paused) return;
      paused = false;
      retry = 0;
      void connect();
    },
  };
}
