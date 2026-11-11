import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AuthRequiredError, listAllConsents, listPending } from '../lib/api';
import { ensureDevice } from '../lib/device';
import { beginLogin, clearToken, demoAvailable, enableDemo, getToken } from '../lib/auth';
import { formatRemaining, riskLabel, statusLabel, type ConsentRequest } from '../lib/format';
import { openConsentStream, type StreamStatus } from '../lib/stream';

const STATUS_TEXT: Record<StreamStatus, string> = {
  connecting: '连接中',
  open: '实时',
  error: '重连中',
  closed: '已断开',
};

export default function PendingPage() {
  const [items, setItems] = useState<ConsentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authLost, setAuthLost] = useState(false);
  const [stream, setStream] = useState<StreamStatus>('connecting');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()));
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (!getToken()) return;
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const data = scope === 'all' ? await listAllConsents('pending') : await listPending();
      setItems(data);
      setError('');
      setAuthLost(false);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        // The token is gone or expired: drop it so the header shows "登录"
        // and give the user a button instead of a dead end.
        clearToken();
        setLoggedIn(false);
        setAuthLost(true);
        setError('登录已过期，请重新登录。');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (!loggedIn) return;
    void load();
    ensureDevice().catch(() => undefined);
  }, [loggedIn, load]);

  useEffect(() => {
    if (!loggedIn) return;
    const handle = openConsentStream({
      // Events are only change signals: always refetch.
      onChange: () => void load(),
      onStatus: setStream,
    });
    const onVisibility = () => {
      if (document.hidden) {
        handle.pause();
      } else {
        handle.resume();
        void load();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      handle.close();
    };
  }, [loggedIn, load]);

  if (!loggedIn) {
    return (
      <section className="card hero">
        <div className="hero-badge">Consent</div>
        <h1>Agent 要执行高风险动作时，这里点一下</h1>
        <p className="muted">
          {authLost
            ? '登录已过期。重新登录后继续处理待确认请求。'
            : '用平台账号登录后，查看待确认请求。低风险自动执行，敏感动作需要你批准。'}
        </p>
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            onClick={() => beginLogin('/').catch((e) => setError(String(e)))}
          >
            {authLost ? '重新登录' : '登录并查看'}
          </button>
          {demoAvailable() && (
            <button className="btn btn-ghost" onClick={enableDemo}>
              本地演示（mock）
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>待确认</h1>
          <p className="muted">
            按风险与到期时间排序；批准后参数不可改。
            <span className={`stream-badge stream-${stream}`}>{STATUS_TEXT[stream]}</span>
          </p>
        </div>
        <div className="section-actions">
          <button
            className="btn btn-ghost"
            onClick={() => {
              setError('');
              setScope((s) => (s === 'all' ? 'mine' : 'all'));
            }}
          >
            {scope === 'all' ? '只看我的租户' : '全部租户'}
          </button>
          <button className="btn btn-ghost" onClick={() => void load()}>刷新</button>
        </div>
      </div>

      {loading && items.length === 0 && <div className="card muted">加载中…</div>}
      {error && <div className="card error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="card empty">
          <strong>没有待确认请求</strong>
          <span className="muted">Agent 发起高危动作时会出现在这里。</span>
        </div>
      )}

      <div className="list">
        {items.map((item) => (
          <Link className="card item" key={item.id} to={`/c/${item.id}`}>
            <div className="item-main">
              <div className="item-title">
                <span className={`risk risk-${item.risk}`}>{riskLabel(item.risk)}</span>
                <strong>{item.action}</strong>
              </div>
              <div className="muted">
                目标：{item.target || '—'} · 申请人：{item.requester_id || '—'}
              </div>
              {item.summary && <div className="reason">{item.summary}</div>}
              {!item.summary && item.reason && <div className="reason">{item.reason}</div>}
            </div>
            <div className="item-side">
              <span className="status">{statusLabel(item.status)}</span>
              <span className="muted">{formatRemaining(item.expires_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
