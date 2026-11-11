/**
 * 统一解析平台错误信封。
 *
 * 后端标准形状：{ code, error, detail?, title?, retryable? }
 * OAuth 形状：{ error, error_description }
 * 旧中间件可能仍返回 { error }。按 detail → title → error_description → error →
 * message 的顺序取第一条非空文案；全部失败时回退到原文本。
 */
export function parseErrorMessage(text: string, status?: number): string {
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    for (const key of ['detail', 'title', 'error_description', 'error', 'message']) {
      const value = body[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  } catch {
    // 非 JSON：按纯文本处理。
  }
  const trimmed = text.trim();
  if (trimmed) return status ? `${status} ${trimmed.slice(0, 300)}` : trimmed.slice(0, 300);
  return status ? `HTTP ${status}` : '请求失败';
}
