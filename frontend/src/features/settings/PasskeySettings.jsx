import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { createPasskey, describeWebAuthnError, isMobileDevice, isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '../../lib/webauthn';
import { relativeTime } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Button, Card, CardHeader, Spinner } from '../../components/ui';

/** Best-effort human label for the device the passkey lives on. */
const deviceLabel = () => {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone / iPad (Face ID or Touch ID)';
  if (/android/i.test(ua)) return 'Android device (biometrics)';
  if (/macintosh/i.test(ua)) return 'Mac (Touch ID)';
  if (/windows/i.test(ua)) return 'Windows PC (Windows Hello)';
  return isMobileDevice() ? 'Mobile device' : 'This device';
};

/**
 * Security → Register Passkey/Biometric.
 *
 * Only the WebAuthn credential (id, public key, counter) is stored server-side
 * — the fingerprint/Face ID itself never leaves the device's secure hardware.
 */
const PasskeySettings = () => {
  const toast = useToast();
  const passkeys = useApi(() => api.auth.passkeys(), []);
  const [registering, setRegistering] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const supported = isWebAuthnSupported();
  const [platformReady, setPlatformReady] = useState(true);

  const records = passkeys.data?.credentials || [];

  const register = async () => {
    if (!supported) {
      toast.error('This browser does not support passkeys. Try a modern browser on your phone, tablet or laptop.');
      return;
    }
    setRegistering(true);
    try {
      const options = await api.auth.passkeyRegisterOptions();
      const attestation = await createPasskey(options.data.options);
      await api.auth.passkeyRegisterVerify({
        response: attestation,
        deviceName: deviceLabel(),
        attachment: attestation?.authenticatorAttachment || '',
      });
      toast.success('Passkey registered. You can now approve sign-ins with your device biometrics.');
      passkeys.reload();
    } catch (error) {
      if (error?.name) {
        toast.error(describeWebAuthnError(error).message);
      } else {
        toast.error(error?.message || 'The passkey could not be registered. Please try again.');
      }
    } finally {
      setRegistering(false);
    }
  };

  const remove = async (credential) => {
    setRemovingId(credential._id);
    try {
      await api.auth.removePasskey(credential._id);
      toast.success('Passkey removed');
      passkeys.reload();
    } catch (error) {
      toast.error(error?.message || 'The passkey could not be removed');
    } finally {
      setRemovingId(null);
    }
  };

  // Probe the platform authenticator once so we can be honest about support.
  useEffect(() => {
    let cancelled = false;
    if (!supported) {
      setPlatformReady(false);
      return undefined;
    }
    isPlatformAuthenticatorAvailable()
      .then((available) => {
        if (!cancelled) setPlatformReady(available);
      })
      .catch(() => {
        if (!cancelled) setPlatformReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  return (
    <Card>
      <CardHeader
        title="Passkeys & device biometrics"
        subtitle="Approve sign-ins with Touch ID, Face ID, Windows Hello or a security key"
        icon="spark"
        action={
          <Button icon="plus" loading={registering} onClick={register} disabled={!supported}>
            Register passkey
          </Button>
        }
      />
      <div className="card-pad space-y-4">
        {!supported && (
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            This browser does not support passkeys. You can still sign in with the one-time verification code sent to your
            e-mail.
          </p>
        )}

        {supported && !platformReady && (
          <p className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            No built-in biometric sensor was detected, but you can still register a security key (USB/NFC).
          </p>
        )}

        {passkeys.loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Spinner size="sm" /> Loading your passkeys…
          </p>
        ) : records.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No passkeys yet. Register this device to skip the e-mail code next time you sign in.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((credential) => (
              <li key={credential._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                    <Icon name="spark" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{credential.deviceName || 'Passkey'}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Added {relativeTime(credential.createdAt)}
                      {credential.lastUsedAt ? ` · last used ${relativeTime(credential.lastUsedAt)}` : ' · not used yet'}
                    </span>
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  loading={removingId === credential._id}
                  onClick={() => remove(credential)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Icon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          EventSphere stores only your device&rsquo;s public key. Your fingerprint or face data never leaves your device and is
          never sent to or stored on our servers.
        </p>
      </div>
    </Card>
  );
};

export default PasskeySettings;
