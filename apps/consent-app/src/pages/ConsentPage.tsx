import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AuthRequiredError, cancelConsent, decide, getConsent } from '../lib/api';
import { beginLogin, getToken } from '../lib/auth';
import {
  formatRemaining,
  riskLabel,
  shortHash,
  statusLabel,
  type ConsentRequest,
} from '../lib/format';

export default function ConsentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ConsentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<'approved' | 'rejected' | 'canceled' | ''>('');

  useEffect(() => {
    if (!getToken()) {
      beginLogin(`/c/${id}`).catch((e) => setError(String(e)));
      return;
    }
    let cancelled = false;
    setLoading(true);
    getConsent(id)
      .then((data) => {
        if (!cancelled) setItem(data);
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
  }, [id]);

  async function onDecide(decision: 'approved' | 'rejected') {
    setSubmitting(decision);
    setError('');
    try {
      await decide(id, decision);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting('');
    }
  }

  async function onCancel() {
    setSubmitting('canceled');
    setError('');
    try {
      await cancelConsent(id, 'PWA cancel');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting('');
    }
  }

  if (loading) return <div className="card muted">加载中…</div>;
  if (error) {
    return (
      <section className="card">
        <h1>无法打开</h1>
        <p className="error">{error}</p>
        <Link className="btn" to="/">返回列表</Link>
      </section>
    );
  }
  if (!item) return <div className="card">请求不存在。</div>;

  const pending = item.status === 'pending';

  return (
    <section className="card detail">
      <div className="detail-head">
        <span className={`risk risk-${item.risk}`}>{riskLabel(item.risk)}</span>
        <span className="status">{statusLabel(item.status)}</span>
      </div>
      <h1>{item.action}</h1>
      <dl className="kv">
        <div><dt>目标</dt><dd>{item.target || '—'}</dd></div>
        <div><dt>申请人</dt><dd>{item.requester_type || 'agent'} / {item.requester_id || '—'}</dd></div>
        <div><dt>理由</dt><dd>{item.reason || '—'}</dd></div>
        <div><dt>参数哈希</dt><dd className="mono">{shortHash(item.params_hash)}</dd></div>
        <div><dt>到期</dt><dd>{formatRemaining(item.expires_at)}</dd></div>
      </dl>

      {pending ? (
        <div className="actions">
          <button
            className="btn btn-danger"
            disabled={Boolean(submitting)}
            onClick={() => onDecide('rejected')}
          >
            {submitting === 'rejected' ? '提交中…' : '拒绝'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={Boolean(submitting)}
            onClick={onCancel}
          >
            {submitting === 'canceled' ? '撤销中…' : '撤销'}
          </button>
          <button
            className="btn btn-primary"
            disabled={Boolean(submitting)}
            onClick={() => onDecide('approved')}
          >
            {submitting === 'approved' ? '提交中…' : '允许'}
          </button>
        </div>
      ) : (
        <p className="muted">该请求已处理（{statusLabel(item.status)}）。</p>
      )}
      <Link className="btn btn-ghost" to="/">返回列表</Link>
    </section>
  );
}
