import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginVerification from './LoginVerification';

const verifyLoginCode = vi.fn();
const resendLoginCode = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ verifyLoginCode, verifyPasskeyLogin: vi.fn() }),
}));

vi.mock('../../lib/api', () => ({
  default: { auth: { resendLoginCode: (...args) => resendLoginCode(...args) } },
}));

vi.mock('../../lib/webauthn', () => ({
  isWebAuthnSupported: () => false,
  isPlatformAuthenticatorAvailable: async () => false,
  isMobileDevice: () => false,
  describeWebAuthnError: () => ({ cancelled: true, message: 'cancelled' }),
  getPasskeyAssertion: vi.fn(),
}));

const challenge = {
  challengeToken: 'a'.repeat(64),
  maskedEmail: 'a*****@example.com',
  codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  cooldownSeconds: 30,
  codeLength: 6,
  resendsRemaining: 5,
  passkeyAvailable: false,
};

const enterCodeAndSubmit = async (code = '123456') => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Digit 1 of 6'), code);
  await user.click(screen.getByRole('button', { name: /verify and sign in/i }));
};

describe('LoginVerification', () => {
  beforeEach(() => {
    verifyLoginCode.mockReset();
    resendLoginCode.mockReset();
  });

  it('shows the masked address, the delivery message and a resend countdown', () => {
    render(<LoginVerification challenge={challenge} onVerified={vi.fn()} onRestart={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('a*****@example.com')).toBeInTheDocument();
    expect(screen.getByText(/may take a few moments to arrive/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend code in \d+s/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /verify and sign in/i })).toBeDisabled();
  });

  it('reports an incorrect code using the server message', async () => {
    verifyLoginCode.mockRejectedValue({
      status: 400,
      code: 'OTP_INVALID',
      message: 'That verification code is incorrect. Please check your e-mail and try again (4 attempts left).',
    });
    render(<LoginVerification challenge={challenge} onVerified={vi.fn()} onRestart={vi.fn()} onBack={vi.fn()} />);

    await enterCodeAndSubmit('000000');

    expect(await screen.findByText(/4 attempts left/i)).toBeInTheDocument();
    expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
  });

  it('offers a resend (not "invalid code") when the code has expired', async () => {
    verifyLoginCode.mockRejectedValue({ status: 400, code: 'OTP_EXPIRED', message: 'expired' });
    render(<LoginVerification challenge={challenge} onVerified={vi.fn()} onRestart={vi.fn()} onBack={vi.fn()} />);

    await enterCodeAndSubmit();

    const expired = await screen.findAllByText(/has expired\. Request a new code to continue/i);
    expect(expired.length).toBeGreaterThan(0);
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
  });

  it('never claims the code was wrong when the connection fails', async () => {
    verifyLoginCode.mockRejectedValue({ status: 0, isNetworkError: true, message: 'Network Error' });
    render(<LoginVerification challenge={challenge} onVerified={vi.fn()} onRestart={vi.fn()} onBack={vi.fn()} />);

    await enterCodeAndSubmit();

    expect(await screen.findByText(/connection problem/i)).toBeInTheDocument();
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
  });

  it('moves to the restart state when the verification session is gone', async () => {
    verifyLoginCode.mockRejectedValue({ status: 401, message: 'expired session' });
    render(<LoginVerification challenge={challenge} onVerified={vi.fn()} onRestart={vi.fn()} onBack={vi.fn()} />);

    await enterCodeAndSubmit();

    expect(await screen.findByText(/verification session ended/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start sign-in again/i })).toBeInTheDocument();
  });

  it('signs the user in when the code is accepted', async () => {
    const onVerified = vi.fn();
    verifyLoginCode.mockResolvedValue({ _id: 'u1', name: 'Jordan Blake', role: 'attendee' });
    render(<LoginVerification challenge={challenge} onVerified={onVerified} onRestart={vi.fn()} onBack={vi.fn()} />);

    await enterCodeAndSubmit();

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(expect.objectContaining({ role: 'attendee' })));
  });

  it('only reports a resend after the server confirms it', async () => {
    const user = userEvent.setup();
    resendLoginCode.mockRejectedValue({ status: 0, isNetworkError: true });
    render(<LoginVerification challenge={{ ...challenge, cooldownSeconds: 0 }} onVerified={vi.fn()} onRestart={vi.fn()} onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /resend verification code/i }));

    expect(await screen.findByText(/unable to send a new verification code/i)).toBeInTheDocument();
    expect(screen.queryByText(/new verification code has been sent/i)).not.toBeInTheDocument();

    resendLoginCode.mockResolvedValue({ data: { devCode: '111111', cooldownSeconds: 30, maskedEmail: 'a*****@example.com' } });
    await user.click(screen.getByRole('button', { name: /retry resend/i }));

    expect(await screen.findByText(/new verification code has been sent/i)).toBeInTheDocument();
  });
});
