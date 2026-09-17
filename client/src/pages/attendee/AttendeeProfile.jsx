import { useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate, initials, mediaUrl } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Avatar, Badge, Button, Card, CardHeader, Input, Textarea } from '../../components/ui';
import { EmptyState, ErrorState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const AttendeeProfile = () => {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    organization: user?.organization || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    linkedin: user?.linkedin || '',
    twitter: user?.twitter || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: true,
    marketingEmails: false,
    sessionReminders: true,
    appointmentReminders: true,
    newsletter: false,
  });

  const handleChange = (field) => (e) => {
    if (field === 'password') {
      setPasswordData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    } else if (field === 'preferences') {
      setPreferences((prev) => ({ ...prev, [e.target.name]: e.target.checked }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.users.updateMe(formData);
      updateUser(response.data);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error?.message || 'Could not update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await api.auth.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error?.message || 'Could not change password');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (file) => {
    setAvatarLoading(true);
    try {
      const response = await api.users.uploadAvatar(file);
      updateUser(response.data);
      toast.success('Avatar updated');
    } catch (error) {
      toast.error(error?.message || 'Could not upload avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handlePreferencesSave = async () => {
    setLoading(true);
    try {
      await api.users.updatePreferences(preferences);
      toast.success('Preferences saved');
    } catch (error) {
      toast.error(error?.message || 'Could not save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Profile settings" subtitle="Manage your personal information, security and notification preferences." icon="user-cog" />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="lg:sticky lg:top-24">
          <div className="card-pad text-center">
            <div className="relative mx-auto">
              <Avatar
                src={user?.avatar}
                name={user?.name}
                size="xl"
                className="ring-4 ring-white dark:ring-slate-900"
              />
              <label
                className="absolute bottom-0 right-0 rounded-full bg-brand-600 p-1.5 text-white hover:bg-brand-700 cursor-pointer transition"
                title="Change avatar"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => e.target.files[0] && handleAvatarUpload(e.target.files[0])}
                  disabled={avatarLoading}
                />
                <Icon name="camera" className="h-4 w-4" />
              </label>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{formData.name || 'Your name'}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formData.email}</p>
            {user?.role && <Badge className="mt-2" tone="info">{titleCase(user.role)}</Badge>}
            <p className="mt-3 text-xs text-slate-400">Member since {formatDate(user?.createdAt)}</p>

            <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <Tabs
                active={activeTab}
                onChange={setActiveTab}
                tabs={[
                  { value: 'profile', label: 'Profile', icon: 'user' },
                  { value: 'security', label: 'Security', icon: 'lock' },
                  { value: 'notifications', label: 'Notifications', icon: 'bell' },
                ]}
                className="w-full"
              />
            </div>
          </div>
        </Card>

        <Card className="flex-1">
          {activeTab === 'profile' && (
            <div className="card-pad space-y-6">
              <div className="border-b border-slate-200 pb-6 dark:border-slate-700">
                <h3 className="text-lg font-semibold">Basic information</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This information is visible to other attendees and exhibitors when you interact.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Full name</label>
                  <Input value={formData.name} onChange={handleChange('name')} placeholder="Your name" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <Input value={formData.email} onChange={handleChange('email')} type="email" placeholder="you@example.com" disabled />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Email changes require verification from account settings.</p>
                </div>
                <div>
                  <label className="label">Organization</label>
                  <Input value={formData.organization} onChange={handleChange('organization')} placeholder="Company or institution" />
                </div>
                <div>
                  <label className="label">Location</label>
                  <Input value={formData.location} onChange={handleChange('location')} placeholder="City, Country" />
                </div>
              </div>

              <div>
                <label className="label">Bio</label>
                <Textarea
                  value={formData.bio}
                  onChange={handleChange('bio')}
                  rows={4}
                  placeholder="Tell others about yourself, your interests and what you are looking for at events…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Website</label>
                  <Input value={formData.website} onChange={handleChange('website')} type="url" placeholder="https://your-site.com" />
                </div>
                <div>
                  <label className="label">LinkedIn</label>
                  <Input value={formData.linkedin} onChange={handleChange('linkedin')} placeholder="linkedin.com/in/yourprofile" />
                </div>
                <div>
                  <label className="label">Twitter / X</label>
                  <Input value={formData.twitter} onChange={handleChange('twitter')} placeholder="@yourhandle" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button className="w-full sm:w-auto" icon="save" loading={loading} onClick={handleSubmit}>
                  Save changes
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card-pad space-y-6">
              <div className="border-b border-slate-200 pb-6 dark:border-slate-slate-700">
                <h3 className="text-lg font-semibold">Change password</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your password must be at least 8 characters long.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Current password</label>
                  <Input
                    name="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={handleChange('password')}
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="label">New password</label>
                  <Input
                    name="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={handleChange('password')}
                    placeholder="Enter new password"
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <Input
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={handleChange('password')}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <Button variant="secondary" icon="lock" loading={loading} onClick={handlePasswordChange}>
                Update password
              </Button>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold">Active sessions</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage where you are logged in.</p>
                <Button variant="ghost" icon="logout" className="mt-3" onClick={() => {}}>
                  Log out of all other devices
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card-pad space-y-6">
              <div className="border-b border-slate-200 pb-6 dark:border-slate-700">
                <h3 className="text-lg font-semibold">Notification preferences</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Control how and when you receive updates.</p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'emailNotifications', label: 'Email notifications', desc: 'Receive important updates via email' },
                  { key: 'pushNotifications', label: 'Push notifications', desc: 'Get browser notifications for real-time updates' },
                  { key: 'sessionReminders', label: 'Session reminders', desc: 'Be notified 15 minutes before registered sessions start' },
                  { key: 'appointmentReminders', label: 'Appointment reminders', desc: 'Reminders for upcoming meetings with exhibitors' },
                  { key: 'marketingEmails', label: 'Marketing emails', desc: 'Occasional news about new features and events' },
                  { key: 'newsletter', label: 'Newsletter', desc: 'Monthly digest of event highlights and tips' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences[item.key]}
                      onChange={handleChange('preferences')}
                      className="checkbox h-5 w-5"
                    />
                  </div>
                ))}
              </div>

              <Button icon="save" loading={loading} onClick={handlePreferencesSave}>
                Save preferences
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AttendeeProfile;