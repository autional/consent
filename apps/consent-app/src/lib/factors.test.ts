import { describe, expect, it } from 'vitest';
import { availableFactors, factorLabel, resolveFactor } from './factors';

describe('approval channel selection', () => {
  it('offers both concrete channels when the policy sends accepted_factors', () => {
    const item = { accepted_factors: ['sms_otp', 'email_link'], required_factor: 'sms_otp' };
    expect(availableFactors(item)).toEqual(['sms_otp', 'email_link']);
    expect(resolveFactor(item, '')).toBe('sms_otp');
    expect(resolveFactor(item, 'email_link')).toBe('email_link');
  });

  it('falls back to required_factor when accepted_factors is missing', () => {
    expect(availableFactors({ required_factor: 'sms_otp' })).toEqual(['sms_otp']);
    expect(availableFactors({ required_factor: 'email_link' })).toEqual(['email_link']);
    expect(availableFactors({})).toEqual([]);
  });

  it('keeps webauthn out of the picker but preserves the legacy default', () => {
    const item = { accepted_factors: ['webauthn'], required_factor: 'webauthn' };
    expect(availableFactors(item)).toEqual([]);
    expect(resolveFactor(item, '')).toBe('webauthn');
    // 完全没有任何策略字段时仍退回旧默认值。
    expect(resolveFactor({}, '')).toBe('sms_otp');
  });

  it('drops a stale selection once the policy no longer offers it', () => {
    const item = { accepted_factors: ['sms_otp'], required_factor: 'sms_otp' };
    expect(resolveFactor(item, 'email_link')).toBe('sms_otp');
  });

  it('labels the channels in the same wording as the rest of the app', () => {
    expect(factorLabel('sms_otp')).toBe('短信验证码');
    expect(factorLabel('email_link')).toBe('邮件链接');
    expect(factorLabel('webauthn')).toBe('通行密钥');
  });
});
