import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Segmented one-time-code input.
 *
 * - auto-advances as digits are typed, backspace steps back
 * - distributes a pasted code across the boxes
 * - `autocomplete="one-time-code"` lets iOS/Android offer the SMS/e-mail code
 * - fully keyboard accessible (arrow keys, Home/End, Delete)
 */
const OtpInput = ({ length = 6, value = '', onChange, disabled = false, error = false, autoFocus = true, label = 'Verification code' }) => {
  const inputs = useRef([]);
  const digits = useMemo(() => {
    const chars = String(value).replace(/\D/g, '').split('');
    return Array.from({ length }, (_, index) => chars[index] || '');
  }, [value, length]);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const commit = useCallback(
    (next) => {
      onChange?.(next.join('').replace(/\D/g, '').slice(0, length));
    },
    [length, onChange],
  );

  const focusAt = (index) => inputs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  const handleChange = (index) => (event) => {
    const raw = event.target.value.replace(/\D/g, '');
    if (!raw) return;
    const next = [...digits];
    // A multi-character value means the code was pasted into one box.
    raw.split('').forEach((char, offset) => {
      if (index + offset < length) next[index + offset] = char;
    });
    commit(next);
    focusAt(index + raw.length);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        commit(next);
      } else if (index > 0) {
        next[index - 1] = '';
        commit(next);
        focusAt(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (index) => (event) => {
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    const next = [...digits];
    pasted.split('').forEach((char, offset) => {
      if (index + offset < length) next[index + offset] = char;
    });
    commit(next);
    focusAt(index + pasted.length);
  };

  return (
    <div className="flex items-center justify-between gap-2" role="group" aria-label={label}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          value={digit}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste(index)}
          onFocus={(event) => event.target.select()}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={length}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          className={cn(
            'h-14 w-full min-w-0 rounded-xl border bg-white text-center text-xl font-semibold tracking-widest text-slate-900 shadow-sm outline-none transition',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60',
            'dark:bg-slate-900 dark:text-white',
            error ? 'border-rose-400 dark:border-rose-700' : 'border-slate-300 dark:border-slate-700',
          )}
        />
      ))}
    </div>
  );
};

export default OtpInput;
