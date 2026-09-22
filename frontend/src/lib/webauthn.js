import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

/**
 * Browser-side WebAuthn/passkey support.
 *
 * The fingerprint/Face ID itself never reaches this code or the server — the
 * browser hands the ceremony to the platform authenticator and returns only a
 * public-key credential or a signature, which is what the API verifies.
 */

export const isWebAuthnSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.PublicKeyCredential !== 'undefined' &&
  typeof navigator?.credentials?.get === 'function';

/** True when the device has a built-in authenticator (Touch ID, Windows Hello…). */
export const isPlatformAuthenticatorAvailable = async () => {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

/** Coarse device check: biometric sign-in is offered first on phones/tablets. */
export const isMobileDevice = () =>
  typeof navigator !== 'undefined' &&
  (/android|iphone|ipad|ipod|mobile|windows phone/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent)));

/**
 * Turn any WebAuthn failure into a friendly, non-technical message.
 * `cancelled` lets the caller silently fall back to the e-mail code when the
 * user simply dismissed the biometric prompt.
 */
export const describeWebAuthnError = (error) => {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return {
      cancelled: true,
      message: 'Biometric verification was cancelled. You can verify your account with the code sent to your e-mail.',
    };
  }
  if (name === 'InvalidStateError') {
    return {
      cancelled: false,
      message: 'This device is already registered as a passkey. You can sign in with it or use the e-mail code.',
    };
  }
  if (name === 'SecurityError' || name === 'NotSupportedError') {
    return {
      cancelled: false,
      message: 'Biometric sign-in is not available in this browser. Please verify with the code sent to your e-mail.',
    };
  }
  return {
    cancelled: false,
    message: 'Biometric verification couldn\u2019t be completed. You can verify your account using the code sent to your e-mail.',
  };
};

/** Run a registration ceremony (Security settings → register this device). */
export const createPasskey = async (options) => startRegistration({ optionsJSON: options });

/** Run an authentication ceremony (second factor of sign-in). */
export const getPasskeyAssertion = async (options) => startAuthentication({ optionsJSON: options });
