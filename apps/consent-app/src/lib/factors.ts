import type { ConsentRequest } from './format';

/**
 * 审批时可选的「具体通道」。
 *
 * `webauthn` 故意不在此列：它有自己的按钮、自己的 challenge 载荷（公钥选项 +
 * 断言），与「发码 / 发链接」是两条互斥的路径，放进选择器只会让人误以为可以二选一。
 */
export const SELECTABLE_FACTORS = ['sms_otp', 'email_link'] as const;

export type SelectableFactor = (typeof SELECTABLE_FACTORS)[number];

type FactorSource = Pick<ConsentRequest, 'accepted_factors' | 'required_factor'>;

export function isSelectableFactor(value: string | null | undefined): value is SelectableFactor {
  return typeof value === 'string' && (SELECTABLE_FACTORS as readonly string[]).includes(value);
}

export function factorLabel(factor: string): string {
  switch (factor) {
    case 'sms_otp':
      return '短信验证码';
    case 'email_link':
      return '邮件链接';
    case 'webauthn':
      return '通行密钥';
    default:
      return factor;
  }
}

/**
 * 本请求可用的具体通道。
 *
 * 优先读 `accepted_factors`（策略引擎下发的全集），缺失时回退旧的单值
 * `required_factor`；两者都没有则返回空数组（页面保持原有默认行为）。
 * 非具体通道（如 `webauthn`）会被过滤，避免在选择器里出现无意义的选项。
 */
export function availableFactors(item: FactorSource | null | undefined): SelectableFactor[] {
  if (!item) return [];
  const declared = item.accepted_factors?.length
    ? item.accepted_factors
    : item.required_factor
      ? [item.required_factor]
      : [];
  const out: SelectableFactor[] = [];
  for (const factor of declared) {
    if (isSelectableFactor(factor) && !out.includes(factor)) out.push(factor);
  }
  return out;
}

/**
 * 默认选中的通道：`required_factor` 指向的那个（用户最初的诉求），
 * 不在候选里时退回第一个。没有候选则返回 undefined。
 */
export function defaultFactor(item: FactorSource | null | undefined): SelectableFactor | undefined {
  const options = availableFactors(item);
  if (options.length === 0) return undefined;
  const required = item?.required_factor;
  return isSelectableFactor(required) && options.includes(required) ? required : options[0];
}

/**
 * 实际用于签发 challenge 与提交决策的通道。
 *
 * 顺序：用户显式选择（且仍在候选内）→ 默认通道 → 保持旧行为
 * （`required_factor`，最后兜底 `sms_otp`），这样只有 webauthn 之类的策略
 * 或后端没下发任何通道时行为不变。
 */
export function resolveFactor(item: FactorSource | null | undefined, selected?: string): string {
  const options = availableFactors(item);
  const picked = selected?.trim() ?? '';
  if (picked && options.includes(picked as SelectableFactor)) return picked;
  const fallback = defaultFactor(item);
  if (fallback) return fallback;
  return picked || item?.required_factor || 'sms_otp';
}
