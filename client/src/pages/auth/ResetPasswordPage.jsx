import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import Icon from '../../components/ui/Icon';
import { Button, Field, FormError, Input } from '../../components/ui';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const form = useForm({ password: '', confirmPassword: '' });

  const submit = async (values) => {
    if (values.password !== values.confirmPassword) {
      form.setFormError('Passwords do not match');
      throw new Error('Passwords do not match');
    }
    await api.auth.resetPassword({ token, password: values.password });
    setDone(true);
    toast.success('Password updated — please sign in');
  };

  if (done) {
    return (
      <div>
        <span className="inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
          <Icon name="check" className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Password updated</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your password has been changed and all other sessions were signed out for security.
        </p>
        <Button className="mt-6 w-full" size="lg" icon="logout" onClick={() => navigate('/login', { replace: true })}>
          Sign in with your new password
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        Pick something strong — at least 8 characters with a letter and a number.
      </p>

      <form
        className="mt-7 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit(submit);
        }}
      >
        <FormError errors={form.formError} />
        <Field label="New password" htmlFor="new-password" required error={form.errors.password}>
          <Input
            id="new-password"
            name="password"
            type="password"
            icon="lock"
            value={form.values.password}
            onChange={form.handleChange}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-new-password" required>
          <Input
            id="confirm-new-password"
            name="confirmPassword"
            type="password"
            icon="lock"
            value={form.values.confirmPassword}
            onChange={form.handleChange}
            autoComplete="new-password"
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.submitting} icon="check">
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
};

export default ResetPasswordPage;
