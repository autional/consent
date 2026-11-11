export type Risk = 'R0' | 'R1' | 'R2' | 'R3';

export interface ConsentRequest {
  id: string;
  action: string;
  target: string;
  risk: Risk;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'canceled';
  reason?: string;
  requester_type?: string;
  requester_id?: string;
  expires_at?: string;
  created_at?: string;
  decided_at?: string;
  decided_by?: string;
  params_hash?: string;
  tenant_id?: string;
  /** Floor set by the caller; the effective factor may be higher (policy). */
  required_factor?: string;
  external_action_id?: string;
  summary?: string;
}

export function riskLabel(risk: Risk | string): string {
  switch (risk) {
    case 'R0':
      return '只读';
    case 'R1':
      return '低风险';
    case 'R2':
      return '敏感';
    case 'R3':
      return '破窗';
    default:
      return String(risk);
  }
}

export function statusLabel(status: ConsentRequest['status'] | string): string {
  switch (status) {
    case 'pending':
      return '待确认';
    case 'approved':
      return '已批准';
    case 'rejected':
      return '已拒绝';
    case 'expired':
      return '已过期';
    case 'canceled':
      return '已取消';
    default:
      return String(status);
  }
}

export function formatRemaining(expiresAt: string | undefined, now = Date.now()): string {
  if (!expiresAt) return '—';
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return '已过期';
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时`;
}

export function shortHash(hash?: string): string {
  if (!hash) return '—';
  return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}
