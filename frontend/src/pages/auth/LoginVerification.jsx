import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  describeWebAuthnError,
  getPasskeyAssertion,
  isPlatformAuthenticatorAvailable,
  isWebAuthnSupported,
  isMobileDevice,
} from '../../lib/webauthn';
import Icon from '../../components/ui/Icon';
import OtpInput from '../../components/auth/OtpInput';
import { Button, Spinner } from '../../components/ui';
import { cn } from '../../lib/utils';

const formatSeconds = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, '0')}` : `${total}s`;
};

const Notice = ({ tone = 'info', children, onRetry, retryLabel = 'Try again' }) => {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
  };
  const icons = { info: 'info', success: 'check', warning: 'alert', error: 'alert' };
  return (
    <div className={cn('rounded-xl border px-3.5 py-2.5 text-sm', tones[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="flex items-start gap-2">
        <Icon name={icons[tone]} className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{children}</span>
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline">
          <Icon name="refresh" className="h-3.5 w-3.5" /> {retryLabel}
        </button>
      )}
    </div>
  );
};

/**
 * Second step of sign-in. The backend is the authority on whether a code is
 * still valid — the countdown here is only a visual aid, so a slow page load or
 * a delayed e-mail never invalidates a code that the server still accepts.
 */
const LoginVerification = ({ challenge, onVerified, onRestart, onBack }) => {
  const { verifyLoginCode, verifyPasskeyLogin } = useAuth();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [codeExpired, setCodeExpired] = useState(false);
  const [challengeExpired, setChallengeExpired] = useState(false);
  const [resendExhausted, setResendExhausted] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(
    Number.isFinite(challenge.cooldownSeconds) ? Math.max(0, challenge.cooldownSeconds) : 30,
  );
  const [expiresLeft, setExpiresLeft] = useState(
    Math.max(0, Math.round((new Date(challenge.codeExpiresAt).getTime() - Date.now()) / 1000)),
  );
  const [resendsRemaining, setResendsRemaining] = useState(challenge.resendsRemaining ?? null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [newerCodeIssued, setNewerCodeIssued] = useState(false);
  const [biometricOffered, setBiometricOffered] = useState(false);
  const autoTried = useRef(false);

  const codeLength = challenge.codeLength || 6;
  const maskedEmail = challenge.maskedEmail || 'your registered e-mail address';

  // One visual tick per second: countdown + expiry hint. Never invalidates the
  // code locally — the server decides.
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownLeft((value) => (value > 0 ? value - 1 : 0));
      setExpiresLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (expiresLeft === 0) setCodeExpired(true);
  }, [expiresLeft]);

  const applyChallengeTiming = useCallback((data) => {
    if (data?.expiresAt) {
      setExpiresLeft(Math.max(0, Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
    }
    setCodeExpired(false);
    if (Number.isFinite(data?.cooldownSeconds)) setCooldownLeft(data.cooldownSeconds);
    if (Number.isFinite(data?.resendsRemaining)) setResendsRemaining(data.resendsRemaining);
  }, []);

  const verify = useCallback(
    async (submitted = code) => {
      if (challengeExpired || resendExhausted) return;
      if (submitted.length !== codeLength) {
        setNotice({ tone: 'error', message: `Please enter the complete ${codeLength}-digit code from your e-mail.` });
        return;
      }
      setVerifying(true);
      setNotice(null);
      try {
        const user = await verifyLoginCode({ challengeToken: challenge.challengeToken, code: submitted });
        onVerified(user);
      } catch (error) {
        // Distinguish "wrong code" from "the connection/server failed" so a
        // dropped request never tells the user their code was invalid.
        if (error?.isNetworkError || error?.status === 0) {
          setNotice({
            tone: 'error',
            message: 'Verification could not be completed because of a connection problem. Please check your internet connection and try again.',
            onRetry: () => verify(submitted),
          });
        } else if (error?.status === 401) {
          setChallengeExpired(true);
        } else if (error?.status >= 500) {
          setNotice({
            tone: 'error',
            message: 'Verification could not be completed because the server is unavailable right now. Please try again in a moment.',
            onRetry: () => verify(submitted),
          });
        } else if (error?.code === 'OTP_EXPIRED') {
          setCodeExpired(true);
          setNotice({ tone: 'warning', message: 'Your verification code has expired. Request a new code to continue.' });
        } else if (error?.code === 'OTP_LOCKED') {
          setNotice({
            tone: 'warning',
            message: 'Too many incorrect codes were entered for this sign-in. Request a new verification code to continue.',
          });
        } else {
          setNotice({
            tone: 'error',
            message: error?.message || 'That verification code is incorrect. Please check your e-mail and try again.',
          });
        }
      } finally {
        setVerifying(false);
      }
    },
    [challenge.challengeToken, challengeExpired, code, codeLength, onVerified, resendExhausted, verifyLoginCode],
  );

  const resend = useCallback(async () => {
    if (resending || cooldownLeft > 0) return;
    setResending(true);
    setNotice(null);
    try {
      const response = await api.auth.resendLoginCode(challenge.challengeToken);
      const data = response.data || {};
      setCode('');
      setNewerCodeIssued(true);
      applyChallengeTiming(data);
      setNotice({
        tone: 'success',
        message: `A new verification code has been sent to ${data.maskedEmail || maskedEmail}. It may take a few moments to arrive — only the newest code will work.`,
      });
    } catch (error) {
      if (error?.isNetworkError || error?.status === 0 || error?.status >= 500) {
        setNotice({
          tone: 'error',
          message: 'Unable to send a new verification code. Please check your internet connection and try again.',
          onRetry: () => resend(),
          retryLabel: 'Retry resend',
        });
      } else if (error?.code === 'RESEND_LIMIT_REACHED') {
        setResendExhausted(true);
      } else if (error?.code === 'RESEND_COOLDOWN' || error?.status === 429) {
        const wait = error?.retryAfterSeconds;
        if (Number.isFinite(wait) && wait > 0) setCooldownLeft(wait);
        setNotice({ tone: 'warning', message: error?.message || 'Please wait a moment before requesting another code.' });
      } else if (error?.status === 401) {
        setChallengeExpired(true);
      } else {
        setNotice({
          tone: 'error',
          message: error?.message || 'Unable to send a new verification code right now. Please try again.',
          onRetry: () => resend(),
          retryLabel: 'Try again',
        });
      }
    } finally {
      setResending(false);
    }
  }, [applyChallengeTiming, challenge.challengeToken, cooldownLeft, maskedEmail, resending]);

  /** Device biometrics as an alternative second factor (mobile-first). */
  const unlockWithBiometrics = useCallback(async () => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    setNotice(null);
    try {
      const options = await api.auth.passkeyLoginOptions(challenge.challengeToken);
      const assertion = await getPasskeyAssertion(options.data.options);
      const user = await verifyPasskeyLogin({ challengeToken: challenge.challengeToken, response: assertion });
      onVerified(user);
    } catch (error) {
      if (error?.name) {
        const described = describeWebAuthnError(error);
        setNotice({ tone: described.cancelled ? 'info' : 'warning', message: described.message });
      } else if (error?.status === 401) {
        setChallengeExpired(true);
      } else if (error?.isNetworkError) {
        setNotice({
          tone: 'error',
          message: 'Biometric verification couldn\u2019t be completed because of a connection problem. Please try again or use the e-mail code.',
          onRetry: () => unlockWithBiometrics(),
        });
      } else {
        setNotice({ tone: 'warning', message: error?.message || 'Biometric verification couldn\u2019t be completed. You can verify your account using the code sent to your e-mail.' });
      }
    } finally {
      setPasskeyBusy(false);
    }
  }, [challenge.challengeToken, onVerified, passkeyBusy, verifyPasskeyLogin]);

  // Offer (and on mobile, automatically start) the biometric ceremony when the
  // account has a passkey registered on this kind of device.
  useEffect(() => {
    let cancelled = false;
    if (!challenge.passkeyAvailable || autoTried.current || !isWebAuthnSupported()) return undefined;
    autoTried.current = true;
    (async () => {
      const platformReady = await isPlatformAuthenticatorAvailable();
      if (cancelled || !platformReady) return;
      setBiometricOffered(true);
      if (isMobileDevice()) await unlockWithBiometrics();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.passkeyAvailable]);

  const expiryLabel = useMemo(() => {
    if (codeExpired) return 'This code has expired';
    return `Code expires in ${formatSeconds(expiresLeft)}`;
  }, [codeExpired, expiresLeft]);

  // The temporary verification session itself is gone — only a fresh sign-in
  // can continue.
  if (challengeExpired || resendExhausted) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Verification session ended</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {resendExhausted
            ? 'Too many verification codes were requested for this sign-in.'
            : 'Your sign-in verification session has expired.'}{' '}
          Please sign in again to receive a fresh code. Your e-mail and password will be needed once more.
        </p>
        <div className="mt-6 space-y-3">
          <Notice tone="warning">For your security, a new verification session must be started from the sign-in page.</Notice>
          <Button className="w-full" size="lg" icon="refresh" onClick={onRestart}>
            Start sign-in again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        <Icon name="mail" className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">Verify it&rsquo;s you</h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        A verification code has been sent to your registered e-mail address{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{maskedEmail}</span>. It may take a few moments to arrive.
      </p>

      <div className="mt-6 space-y-4">
        {notice && (
          <Notice tone={notice.tone} onRetry={notice.onRetry} retryLabel={notice.retryLabel}>
            {notice.message}
          </Notice>
        )}

        {newerCodeIssued && !notice && (
          <Notice tone="info">A newer verification code was issued — please use the most recent e-mail.</Notice>
        )}

        <div>
          <label className="label" htmlFor="otp-first">
            {codeLength}-digit verification code
          </label>
          <OtpInput
            length={codeLength}
            value={code}
            onChange={setCode}
            disabled={verifying || resending}
            error={notice?.tone === 'error' || notice?.tone === 'warning'}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={cn(codeExpired ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')}>
              {expiryLabel}
            </span>
            {resendsRemaining !== null && (
              <span className={cn('text-slate-500 dark:text-slate-400', resendsRemaining === 0 && 'text-amber-600 dark:text-amber-400')}>
                {resendsRemaining > 0 ? `${resendsRemaining} resend${resendsRemaining === 1 ? '' : 's'} left` : 'No resends left'}
              </span>
            )}
          </div>
        </div>

        <Button
          type="button"
          className="w-full"
          size="lg"
          icon="check"
          loading={verifying}
          disabled={resending || code.length !== codeLength}
          onClick={() => verify()}
        >
          Verify and sign in
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={resend}
            loading={resending}
            disabled={cooldownLeft > 0 || verifying}
            icon="refresh"
          >
            {cooldownLeft > 0 ? `Resend code in ${formatSeconds(cooldownLeft)}` : 'Resend Verification Code'}
          </Button>

          {biometricOffered && (
            <Button type="button" variant="ghost" icon="spark" onClick={unlockWithBiometrics} loading={passkeyBusy} disabled={verifying}>
              Use device biometrics
            </Button>
          )}
        </div>

        {codeExpired && (
          <Notice tone="warning">
            Your verification code has expired. Request a new code to continue — you will not need to enter your password again.
          </Notice>
        )}

        <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          E-mails can take a minute or two, and sometimes land in spam. You can request a new code without signing in again.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
          <button type="button" onClick={onBack} className="link inline-flex items-center gap-1.5">
            <Icon name="chevron-left" className="h-4 w-4" /> Use a different account
          </button>
          {verifying && (
            <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Spinner size="sm" /> Checking the code…
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginVerification;
