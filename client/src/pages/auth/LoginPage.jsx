import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { DEMO_ACCOUNTS, ROLE_HOME } from '../../lib/constants';
import Icon from '../../components/ui/Icon';
import { Button, Field, FormError, Input } from '../../components/ui';

const LoginPage = () => {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({ email: '', password: '' });

  const submit = async (values) => {
    const user = await login({ email: values.email.trim(), password: values.password });
    toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
    navigate(location.state?.from || ROLE_HOME[user.role] || '/', { replace: true });
  };

  const useDemoAccount = async (account) => {
    form.setValue('email', account.email);
    form.setValue('password', account.password);
    const result = await form.submit(submit);
    if (!result.ok) toast.error('Demo sign-in failed — run the seed script first (npm run seed)');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Sign in to EventSphere</h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        Access your organizer, exhibitor or attendee dashboard.
      </p>

      <form
        className="mt-7 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit(submit);
        }}
      >
        <FormError errors={form.formError} />

        <Field label="Email address" htmlFor="email" required error={form.errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            icon="mail"
            placeholder="you@company.com"
            value={form.values.email}
            onChange={form.handleChange}
            error={form.errors.email}
          />
        </Field>

        <Field label="Password" htmlFor="password" required error={form.errors.password}>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              icon="lock"
              placeholder="••••••••"
              value={form.values.password}
              onChange={form.handleChange}
              error={form.errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name="eye" className="h-4 w-4" />
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="link text-sm">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={form.submitting} icon="logout">
          Sign in
        </Button>
      </form>

      <div className="mt-7 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Icon name="sparkles" className="h-3.5 w-3.5" /> Demo accounts
        </p>
        <div className="mt-3 grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={form.submitting}
              onClick={() => useDemoAccount(account)}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50/60 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-brand-950/40"
            >
              <span className="min-w-0">
                <span className="block font-medium">{account.role}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{account.email}</span>
              </span>
              <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        New to EventSphere?{' '}
        <Link to="/register" className="link">
          Create an account
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
