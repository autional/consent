import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AuthRequiredError, listConsents } from '../lib/api';
import { beginLogin, getToken } from '../lib/auth';
import { riskLabel, statusLabel, type ConsentRequest } from '../lib/format';

const TABS = [
  { value: '', label: '全部' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'canceled', label: '已撤销' },
  { value: 'expired', label: '已过期' },
];

export default function HistoryPage() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<ConsentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      beginLogin('/history').catch((e) => setError(String(e)));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    listConsents(status)
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
  }, [status]);

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>历史</h1>
          <p className="muted">所有确认请求，可按状态筛选；只读。</p>
        </div>
        <Link className="btn btn-ghost" to="/">返回待确认</Link>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`btn ${status === tab.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="card muted">加载中…</div>}
      {error && <div className="card error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="card empty">
          <strong>没有记录</strong>
          <span className="muted">处理过的请求会出现在这里。</span>
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
              <span className="muted">
                {item.decided_at ? new Date(item.decided_at).toLocaleString() : item.expires_at ? new Date(item.expires_at).toLocaleString() : '—'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
