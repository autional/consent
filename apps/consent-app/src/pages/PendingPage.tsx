import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AuthRequiredError, listPending } from '../lib/api';
import { beginLogin, demoAvailable, enableDemo, getToken } from '../lib/auth';
import { formatRemaining, riskLabel, statusLabel, type ConsentRequest } from '../lib/format';

export default function PendingPage() {
  const [items, setItems] = useState<ConsentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loggedIn = Boolean(getToken());

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    listPending()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof AuthRequiredError) {
          setError('登录已过期，请重新登录。');
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <section className="card hero">
        <div className="hero-badge">Consent</div>
        <h1>Agent 要执行高风险动作时，这里点一下</h1>
        <p className="muted">
          用平台账号登录后，查看待确认请求。低风险自动执行，敏感动作需要你批准。
        </p>
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            onClick={() => beginLogin('/').catch((e) => setError(String(e)))}
          >
            登录并查看
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
          <p className="muted">按风险与到期时间排序；批准后参数不可改。</p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>刷新</button>
      </div>

      {loading && <div className="card muted">加载中…</div>}
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
              {item.reason && <div className="reason">{item.reason}</div>}
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
