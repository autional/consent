import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import ConsentPage from './ConsentPage';
import type { ConsentRequest } from '../lib/format';

const mocks = vi.hoisted(() => ({
  getConsent: vi.fn(),
  issueFactorChallenge: vi.fn(),
  decide: vi.fn(),
  cancelConsent: vi.fn(),
}));

vi.mock('../lib/api', () => {
  class AuthRequiredError extends Error {
    constructor() {
      super('AUTH_REQUIRED');
    }
  }
  return {
    AuthRequiredError,
    getConsent: mocks.getConsent,
    issueFactorChallenge: mocks.issueFactorChallenge,
    decide: mocks.decide,
    cancelConsent: mocks.cancelConsent,
  };
});

vi.mock('../lib/auth', () => ({ getToken: () => 'test-token', beginLogin: vi.fn() }));
vi.mock('../lib/device', () => ({ ensureDevice: async () => 'dev-1', getDeviceId: () => 'dev-1' }));
vi.mock('../lib/device_key', () => ({ signDecision: async () => null }));
vi.mock('../lib/webauthn', () => ({ getConsentAssertion: vi.fn() }));

function makeItem(overrides: Partial<ConsentRequest> = {}): ConsentRequest {
  return {
    id: 'c1',
    action: 'refund.create',
    target: 'order/1',
    risk: 'R2',
    status: 'pending',
    params_hash: 'sha256:abc',
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/c/c1']}>
      <Routes>
        <Route path="/c/:id" element={<ConsentPage />} />
        <Route path="/" element={<div>列表页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.decide.mockResolvedValue({ id: 'c1', status: 'approved' });
  mocks.cancelConsent.mockResolvedValue({ id: 'c1', status: 'canceled' });
  mocks.issueFactorChallenge.mockResolvedValue({
    challenge_id: 'ch1',
    factor: 'sms_otp',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    destination: '138****0000',
  });
});

afterEach(() => {
  cleanup();
});

describe('ConsentPage 通道选择', () => {
  it('双通道时出现选择器，默认选中 required_factor', async () => {
    mocks.getConsent.mockResolvedValue(
      makeItem({ accepted_factors: ['sms_otp', 'email_link'], required_factor: 'sms_otp' }),
    );
    renderPage();

    const sms = await screen.findByRole('radio', { name: '短信验证码' });
    const mail = screen.getByRole('radio', { name: '邮件链接' });
    expect(sms).toBeChecked();
    expect(mail).not.toBeChecked();
    expect(screen.getByText('确认通道')).toBeInTheDocument();
  });

  it('单通道时不出现选择器，发送验证码沿用该通道', async () => {
    mocks.getConsent.mockResolvedValue(makeItem({ accepted_factors: ['sms_otp'], required_factor: 'sms_otp' }));
    renderPage();

    await screen.findByText('确认码（敏感动作需要）');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText('确认通道')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    await waitFor(() => expect(mocks.issueFactorChallenge).toHaveBeenCalledWith('c1', 'sms_otp'));
  });

  it('选择 email_link 时 challenge 与 decision 都带 email_link', async () => {
    mocks.getConsent.mockResolvedValue(
      makeItem({ accepted_factors: ['sms_otp', 'email_link'], required_factor: 'email_link' }),
    );
    mocks.issueFactorChallenge.mockResolvedValue({
      challenge_id: 'ch2',
      factor: 'email_link',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      destination: 'o***@example.com',
    });
    renderPage();

    // required_factor=email_link ⇒ 默认已选中邮件链接，改选短信再改回来以验证交互。
    const mail = await screen.findByRole('radio', { name: '邮件链接' });
    const sms = screen.getByRole('radio', { name: '短信验证码' });
    expect(mail).toBeChecked();
    fireEvent.click(sms);
    expect(sms).toBeChecked();
    fireEvent.click(mail);
    expect(mail).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '发送链接' }));
    await waitFor(() => expect(mocks.issueFactorChallenge).toHaveBeenCalledWith('c1', 'email_link'));
    await screen.findByText(/已发送至 o\*\*\*@example\.com/);

    fireEvent.change(screen.getByPlaceholderText('6 位验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '允许' }));

    await waitFor(() => expect(mocks.decide).toHaveBeenCalledTimes(1));
    const [id, decision, , , proof] = mocks.decide.mock.calls[0] as [
      string,
      string,
      string | undefined,
      string | undefined,
      { factor: string; code: string } | undefined,
    ];
    expect(id).toBe('c1');
    expect(decision).toBe('approved');
    expect(proof).toEqual({ factor: 'email_link', code: '123456' });
  });
});
