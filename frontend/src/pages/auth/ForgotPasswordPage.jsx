import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useForm } from '../../hooks/useForm';
import Icon from '../../components/ui/Icon';
import { Button, Field, FormError, Input } from '../../components/ui';

const ForgotPasswordPage = () => {
  const form = useForm({ email: '' });
  const [sent, setSent] = useState(null);

  const submit = async (values) => {
    const response = await api.auth.forgotPassword(values.email.trim());
    setSent({ message: response.message, token: response.data?.resetToken || null, email: values.email.trim() });
  };

  if (sent) {
    return (
      <div>
        <span className="inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
          <Icon name="mail" className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Check your inbox</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sent.message}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          If an account exists for <span className="font-medium">{sent.email}</span> you will receive reset instructions shortly.
        </p>

        {sent.token && (
          <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">Development mode</p>
            <p className="mt-1 text-xs">
              Email delivery is disabled, so the reset link is shown here. The token expires in 30 minutes.
            </p>
            <Link to={`/reset-password/${sent.token}`} className="link mt-2 inline-block break-all text-xs">
              /reset-password/{sent.token.slice(0, 24)}…
            </Link>
          </div>
        )}

        <Link to="/login" className="mt-6 inline-block">
          <Button variant="secondary" icon="chevron-left">
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        Enter the email address on your account and we will send you a secure reset link.
      </p>

      <form
        className="mt-7 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit(submit);
        }}
      >
        <FormError errors={form.formError} />
        <Field label="Email address" htmlFor="forgot-email" required error={form.errors.email}>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            icon="mail"
            value={form.values.email}
            onChange={form.handleChange}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.submitting} icon="send">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Remembered it?{' '}
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
};

export default ForgotPasswordPage;
