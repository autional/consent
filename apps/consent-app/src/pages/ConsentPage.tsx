import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AuthRequiredError, cancelConsent, decide, getConsent, issueFactorChallenge } from '../lib/api';
import { beginLogin, getToken } from '../lib/auth';
import { ensureDevice, getDeviceId } from '../lib/device';
import { signDecision } from '../lib/device_key';
import { getConsentAssertion } from '../lib/webauthn';
import { availableFactors, factorLabel, resolveFactor } from '../lib/factors';
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
  // 选择器里的显式选择；空串表示「沿用默认通道」，真正的通道由 lib/factors 解析。
  const [factor, setFactor] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState('');
  const [codeError, setCodeError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [webauthnBusy, setWebauthnBusy] = useState(false);

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
    // 双通道时用选择器的值；单通道/无通道时沿用默认通道（旧行为不变）。
    const next = resolveFactor(item, factor);
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

  async function onWebAuthn() {
    if (!item) return;
    setWebauthnBusy(true);
    setError('');
    try {
      const ch = await issueFactorChallenge(id, 'webauthn');
      const payload = ch.destination ? JSON.parse(ch.destination) : {};
      const challengeId = payload.challenge_id || ch.challenge_id;
      const options = payload.public_key_options || ch.public_key_options;
      const proof = await getConsentAssertion(challengeId, options);
      const deviceId = await ensureDevice().catch(() => getDeviceId());
      const signature = await signDecision(id, 'approved', item.params_hash ?? '').catch(() => null);
      await decide(
        id,
        'approved',
        deviceId || undefined,
        reason.trim() || undefined,
        { factor: 'webauthn', code: JSON.stringify(proof) },
        signature
          ? { device_signed_at: signature.deviceSignedAt, device_signature: signature.deviceSignature }
          : undefined,
      );
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWebauthnBusy(false);
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
      // 通道与 challenge 保持一致：双通道时取选择器的值，否则取默认通道。
      const proofFactor = resolveFactor(item, factor);
      await decide(
        id,
        decision,
        deviceId || undefined,
        reason.trim() || undefined,
        code.trim() ? { factor: proofFactor, code: code.trim() } : undefined,
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
  // 策略下发的具体通道（读 accepted_factors，缺失回退 required_factor）。
  const channels = availableFactors(item);
  const effectiveFactor = resolveFactor(item, factor);

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
        <div><dt>内容摘要</dt><dd>{item.summary || '—'}</dd></div>
        <div><dt>理由</dt><dd>{item.reason || '—'}</dd></div>
        <div><dt>租户</dt><dd className="mono">{item.tenant_id || '—'}</dd></div>
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
          {channels.length > 1 && (
            <fieldset className="field channel-group">
              <legend className="muted">确认通道</legend>
              <div className="channel-options">
                {channels.map((option) => (
                  <label key={option} className="channel-option">
                    <input
                      type="radio"
                      name="consent-factor"
                      value={option}
                      checked={effectiveFactor === option}
                      onChange={() => setFactor(option)}
                      disabled={Boolean(submitting || sendingCode)}
                    />
                    <span>{factorLabel(option)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
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
                {sendingCode ? '发送中…' : effectiveFactor === 'email_link' ? '发送链接' : '发送验证码'}
              </button>
            </div>
            {codeSent && <span className="muted">已发送至 {codeSent}</span>}
            {codeError && <span className="error">{codeError}</span>}
          </div>
          {(item.accepted_factors?.includes('webauthn') || item.required_factor === 'webauthn') && (
            <div className="actions">
              <button className="btn btn-primary" disabled={Boolean(webauthnBusy || submitting)} onClick={onWebAuthn}>
                {webauthnBusy ? '等待通行密钥…' : '使用通行密钥'}
              </button>
            </div>
          )}
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
