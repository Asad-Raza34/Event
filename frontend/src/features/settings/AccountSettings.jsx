import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { initials, mediaUrl } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Avatar, Button, Card, CardHeader, Field, FormError, Input, Tabs, Textarea, Toggle } from '../../components/ui';
import PasskeySettings from './PasskeySettings';

const AccountSettings = () => {
  const { user, refreshProfile, setProfile } = useAuth();
  const toast = useToast();
  const account = useApi(() => api.users.me(), []);
  const fileRef = useRef(null);
  const [tab, setTab] = useState('profile');
  const [uploading, setUploading] = useState(false);
  const [preferences, setPreferences] = useState({ email: true, inApp: true, chat: true, reminders: true, announcements: true });

  const profileForm = useForm({
    name: '',
    phone: '',
    organization: '',
    jobTitle: '',
    city: '',
    country: '',
    bio: '',
    interests: '',
  });
  const passwordForm = useForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const currentUser = account.data?.user || user;
  const notificationPreferences = account.data?.user?.notificationPreferences;

  useEffect(() => {
    const source = account.data?.user;
    if (!source) return;
    profileForm.reset({
      name: source.name || '',
      phone: source.phone || '',
      organization: source.organization || '',
      jobTitle: source.jobTitle || '',
      city: source.city || '',
      country: source.country || '',
      bio: source.bio || '',
      interests: (source.interests || []).join(', '),
    });
    if (source.notificationPreferences) setPreferences({ ...preferences, ...source.notificationPreferences });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.data]);

  const saveProfile = async () => {
    const result = await profileForm.submit((values) =>
      api.users.updateMe({
        ...values,
        interests: String(values.interests || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    );
    if (result.ok) {
      toast.success('Profile updated');
      if (result.data?.data?.profile !== undefined) setProfile(result.data.data.profile);
      await refreshProfile().catch(() => {});
      account.reload();
    }
  };

  const changePassword = async () => {
    if (passwordForm.values.newPassword !== passwordForm.values.confirmPassword) {
      passwordForm.setFormError('New passwords do not match');
      return;
    }
    const result = await passwordForm.submit((values) =>
      api.auth.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    );
    if (result.ok) {
      toast.success('Password changed');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.users.uploadAvatar(file);
      toast.success('Profile picture updated');
      account.reload();
      await refreshProfile().catch(() => {});
    } catch (error) {
      toast.error(error?.message || 'The image could not be uploaded');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const savePreferences = async (next) => {
    setPreferences(next);
    try {
      await api.users.updatePreferences(next);
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error(error?.message || 'Preferences could not be saved');
    }
  };

  return (
    <div className="space-y-5">
      <Card className="card-pad">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative">
            <Avatar src={currentUser?.avatar} name={currentUser?.name} size="xl" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition hover:bg-brand-700"
              aria-label="Upload profile picture"
            >
              <Icon name="upload" className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{currentUser?.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{currentUser?.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="badge-brand capitalize">{currentUser?.role}</span>
              {currentUser?.isEmailVerified ? <span className="badge-success">Email verified</span> : <span className="badge-warning">Email unverified</span>}
              {uploading && <span className="inline-flex items-center gap-1.5">Uploading…</span>}
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'profile', label: 'Profile', icon: 'user-cog' },
          { value: 'security', label: 'Security', icon: 'lock' },
          { value: 'notifications', label: 'Notifications', icon: 'bell' },
        ]}
      />

      {tab === 'profile' && (
        <Card>
          <CardHeader title="Profile details" subtitle="Shown on your dashboards, passes and messages" icon="user-cog" />
          <div className="card-pad space-y-4">
            <FormError errors={profileForm.formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={profileForm.errors.name}>
                <Input name="name" value={profileForm.values.name} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Email" hint="Contact support to change your email address">
                <Input value={currentUser?.email || ''} readOnly disabled />
              </Field>
              <Field label="Phone">
                <Input name="phone" value={profileForm.values.phone} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Organisation">
                <Input name="organization" value={profileForm.values.organization} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Job title">
                <Input name="jobTitle" value={profileForm.values.jobTitle} onChange={profileForm.handleChange} />
              </Field>
              <Field label="City">
                <Input name="city" value={profileForm.values.city} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Country">
                <Input name="country" value={profileForm.values.country} onChange={profileForm.handleChange} />
              </Field>
              <Field label="Interests" hint="Comma separated — used to recommend expos and sessions">
                <Input name="interests" value={profileForm.values.interests} onChange={profileForm.handleChange} placeholder="robotics, sustainability" />
              </Field>
              <Field label="Bio" className="sm:col-span-2">
                <Textarea name="bio" rows={3} value={profileForm.values.bio} onChange={profileForm.handleChange} maxLength={600} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button icon="check" loading={profileForm.submitting} onClick={saveProfile}>
                Save profile
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'security' && (
        <div className="space-y-5">
        <Card>
          <CardHeader title="Security" subtitle="Update the password used to sign in" icon="lock" />
          <div className="card-pad space-y-4">
            <FormError errors={passwordForm.formError} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Current password" required error={passwordForm.errors.currentPassword}>
                <Input type="password" name="currentPassword" value={passwordForm.values.currentPassword} onChange={passwordForm.handleChange} autoComplete="current-password" />
              </Field>
              <Field label="New password" required error={passwordForm.errors.newPassword} hint="Min 8 chars, with a letter and a number">
                <Input type="password" name="newPassword" value={passwordForm.values.newPassword} onChange={passwordForm.handleChange} autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password" required>
                <Input type="password" name="confirmPassword" value={passwordForm.values.confirmPassword} onChange={passwordForm.handleChange} autoComplete="new-password" />
              </Field>
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Changing your password signs out every other device.
              </p>
              <Button icon="lock" loading={passwordForm.submitting} onClick={changePassword}>
                Update password
              </Button>
            </div>
          </div>
        </Card>

        <PasskeySettings />
        </div>
      )}

      {tab === 'notifications' && (
        <Card>
          <CardHeader title="Notification preferences" subtitle="Choose how EventSphere keeps you informed" icon="bell" />
          <div className="card-pad space-y-5">
            <Toggle
              label="Email notifications"
              description="Digest and important updates delivered to your inbox."
              checked={Boolean(preferences.email)}
              onChange={(value) => savePreferences({ ...preferences, email: value })}
            />
            <Toggle
              label="In-app notifications"
              description="Show notifications in the bell menu and inbox."
              checked={Boolean(preferences.inApp)}
              onChange={(value) => savePreferences({ ...preferences, inApp: value })}
            />
            <Toggle
              label="Chat messages"
              description="Notify me about new messages from exhibitors and attendees."
              checked={Boolean(preferences.chat)}
              onChange={(value) => savePreferences({ ...preferences, chat: value })}
            />
            <Toggle
              label="Session reminders"
              description="Remind me 30 minutes before a session I registered for."
              checked={Boolean(preferences.reminders)}
              onChange={(value) => savePreferences({ ...preferences, reminders: value })}
            />
            <Toggle
              label="Announcements"
              description="Organizer announcements and schedule changes."
              checked={Boolean(preferences.announcements)}
              onChange={(value) => savePreferences({ ...preferences, announcements: value })}
            />
            {notificationPreferences && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saved on the server · last synced {initials(currentUser?.name || '')}
              </p>
            )}
          </div>
        </Card>
      )}

      <Card className="card-pad">
        <h3 className="text-sm font-semibold">Need to close your account?</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Contact the platform team and we will deactivate your account, cancel upcoming registrations and anonymise your data.
        </p>
        <a className="link mt-2 inline-block text-sm" href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || 'support@eventsphere.io'}`}>
          <Icon name="mail" className="mr-1.5 inline h-4 w-4" />
          {import.meta.env.VITE_SUPPORT_EMAIL || 'support@eventsphere.io'}
        </a>
      </Card>

      {currentUser?.avatar && <p className="sr-only">Current avatar: {mediaUrl(currentUser.avatar)}</p>}
    </div>
  );
};

export default AccountSettings;
