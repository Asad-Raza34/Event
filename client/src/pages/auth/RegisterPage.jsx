import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { ROLE_HOME } from '../../lib/constants';
import Icon from '../../components/ui/Icon';
import { Button, Field, FormError, Input, Select } from '../../components/ui';

const ROLES = [
  { value: 'attendee', label: 'Attendee', description: 'Discover expos, register, book meetings and get a QR pass.', icon: 'ticket' },
  { value: 'exhibitor', label: 'Exhibitor', description: 'Apply to expos, reserve booths and manage your company profile.', icon: 'building' },
  { value: 'admin', label: 'Organizer', description: 'Create expos, approve exhibitors and run the whole programme.', icon: 'settings' },
];

const RegisterPage = () => {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState('attendee');
  const form = useForm({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    organization: '',
    jobTitle: '',
    city: '',
    country: '',
    adminInviteCode: '',
  });

  const submit = async (values) => {
    if (values.password !== values.confirmPassword) {
      form.setFormError('Passwords do not match');
      throw new Error('Passwords do not match');
    }
    const user = await register({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      role,
      phone: values.phone,
      organization: values.organization,
      jobTitle: values.jobTitle,
      city: values.city,
      country: values.country,
      adminInviteCode: role === 'admin' ? values.adminInviteCode : undefined,
    });
    toast.success('Account created — welcome to EventSphere!');
    navigate(ROLE_HOME[user.role] || '/', { replace: true });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Pick how you want to use EventSphere — you can change roles later.</p>

      <div className="mt-6 grid gap-2.5">
        {ROLES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRole(option.value)}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
              role === option.value
                ? 'border-brand-500 bg-brand-50/70 dark:border-brand-500 dark:bg-brand-950/40'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
            }`}
            aria-pressed={role === option.value}
          >
            <span
              className={`rounded-xl p-2 ${
                role === option.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Icon name={option.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
            </span>
            {role === option.value && <Icon name="check" className="ml-auto h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />}
          </button>
        ))}
      </div>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit(submit);
        }}
      >
        <FormError errors={form.formError} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" required error={form.errors.name}>
            <Input id="name" name="name" value={form.values.name} onChange={form.handleChange} placeholder="Ada Lovelace" autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="reg-email" required error={form.errors.email}>
            <Input
              id="reg-email"
              name="email"
              type="email"
              value={form.values.email}
              onChange={form.handleChange}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Password" htmlFor="reg-password" required error={form.errors.password} hint="At least 8 characters with a letter and a number.">
            <Input
              id="reg-password"
              name="password"
              type="password"
              value={form.values.password}
              onChange={form.handleChange}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirm-password" required>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={form.values.confirmPassword}
              onChange={form.handleChange}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" value={form.values.phone} onChange={form.handleChange} placeholder="+1 555 0100" />
          </Field>
          <Field label={role === 'exhibitor' ? 'Company name' : 'Organisation'} htmlFor="organization">
            <Input id="organization" name="organization" value={form.values.organization} onChange={form.handleChange} />
          </Field>
          <Field label="Job title" htmlFor="jobTitle">
            <Input id="jobTitle" name="jobTitle" value={form.values.jobTitle} onChange={form.handleChange} />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" value={form.values.city} onChange={form.handleChange} />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input id="country" name="country" value={form.values.country} onChange={form.handleChange} />
          </Field>
        </div>

        {role === 'admin' && (
          <Field
            label="Organizer invite code"
            htmlFor="adminInviteCode"
            required
            error={form.errors.adminInviteCode}
            hint="Organizer accounts are invitation-only. Ask the platform owner for the code (see server/.env ADMIN_INVITE_CODE)."
          >
            <Input id="adminInviteCode" name="adminInviteCode" value={form.values.adminInviteCode} onChange={form.handleChange} />
          </Field>
        )}

        <Button type="submit" size="lg" className="w-full" loading={form.submitting} icon="spark">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already registered?{' '}
        <Link to="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default RegisterPage;
