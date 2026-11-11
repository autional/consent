import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AuthRequiredError, cancelConsent, decide, getConsent, issueFactorChallenge } from '../lib/api';
import { beginLogin, getToken } from '../lib/auth';
import { ensureDevice, getDeviceId } from '../lib/device';
import { signDecision } from '../lib/device_key';
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
  const [reason, setReason] = useState('');
  const [factor, setFactor] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState('');
  const [codeError, setCodeError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      // Stop the spinner: if beginLogin fails we must show the error instead
      // of waiting forever on "加载中…".
      setLoading(false);
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

  async function onSendCode() {
    const next = factor || item?.required_factor || 'sms_otp';
    setSendingCode(true);
    setCodeError('');
    try {
      const ch = await issueFactorChallenge(id, next);
      setFactor(ch.factor);
      setCodeSent(ch.destination || '已发送');
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendingCode(false);
    }
  }

  async function onDecide(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && !reason.trim()) {
      // A rejection without a reason is useless in the audit trail.
      setError('拒绝需要填写理由（会写入审计）。');
      return;
    }
    setSubmitting(decision);
    setError('');
    try {
      const deviceId = await ensureDevice().catch(() => getDeviceId());
      // Sign the decision so the server can attribute it to this device.
      const signature = await signDecision(id, decision, item?.params_hash ?? '').catch(() => null);
      await decide(
        id,
        decision,
        deviceId || undefined,
        reason.trim() || undefined,
        factor && code.trim() ? { factor, code: code.trim() } : undefined,
        signature
          ? { device_signed_at: signature.deviceSignedAt, device_signature: signature.deviceSignature }
          : undefined,
      );
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
      await cancelConsent(id, reason.trim() || 'PWA cancel');
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
        <div>
          <dt>参数哈希</dt>
          <dd className="mono">
            {shortHash(item.params_hash)}
            {item.params_hash && (
              <button
                className="btn btn-ghost btn-inline"
                onClick={() => {
                  navigator.clipboard?.writeText(item.params_hash ?? '').catch(() => undefined);
                }}
              >
                复制完整哈希
              </button>
            )}
          </dd>
        </div>
        <div><dt>到期</dt><dd>{formatRemaining(item.expires_at)}</dd></div>
      </dl>

      {pending ? (
        <>
          <label className="field">
            <span className="muted">备注（可选）</span>
            <textarea
              className="reason-input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="填写批准/拒绝/撤销原因"
            />
          </label>
          <div className="field">
            <span className="muted">确认码（敏感动作需要）</span>
            <div className="actions">
              <input
                className="reason-input"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6 位验证码"
              />
              <button className="btn btn-ghost" disabled={sendingCode} onClick={onSendCode}>
                {sendingCode ? '发送中…' : '发送验证码'}
              </button>
            </div>
            {codeSent && <span className="muted">已发送至 {codeSent}</span>}
            {codeError && <span className="error">{codeError}</span>}
          </div>
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
        </>
      ) : (
        <p className="muted">该请求已处理（{statusLabel(item.status)}）。</p>
      )}
      <Link className="btn btn-ghost" to="/">返回列表</Link>
    </section>
  );
}
