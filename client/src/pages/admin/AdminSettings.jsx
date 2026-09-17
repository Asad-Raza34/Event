import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { DEMO_ACCOUNTS } from '../../lib/constants';
import { formatDateTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Card, CardHeader, Table } from '../../components/ui';
import { ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import AccountSettings from '../../features/settings/AccountSettings';

const AdminSettings = () => {
  const health = useApi(() => api.health(), []);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Your organizer profile, security and the live status of the EventSphere platform."
        icon="settings"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <AccountSettings />
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Platform status" subtitle="Live API health" icon="globe" />
            <div className="card-pad">
              {health.loading ? (
                <LoadingState rows={1} />
              ) : health.error ? (
                <ErrorState error={health.error} onRetry={health.reload} />
              ) : (
                <dl className="space-y-3 text-sm">
                  {[
                    { label: 'Environment', value: titleCase(health.data?.environment || '—') },
                    { label: 'Database', value: titleCase(health.data?.database || '—') },
                    { label: 'Database mode', value: health.data?.databaseMode || '—' },
                    { label: 'Payment provider', value: titleCase(health.data?.paymentProvider || '—') },
                    { label: 'AI provider', value: health.data?.aiProvider || '—' },
                    { label: 'Realtime', value: health.data?.realtime ? 'Socket.IO connected' : 'Unavailable' },
                    { label: 'API uptime', value: `${Math.round((health.data?.uptimeSeconds || 0) / 60)} min` },
                    { label: 'Checked', value: health.data?.timestamp ? formatDateTime(health.data.timestamp) : '—' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">{item.label}</dt>
                      <dd className="text-right font-medium">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={health.data?.database === 'connected' ? 'success' : 'danger'}>
                  {health.data?.database === 'connected' ? 'Database online' : 'Database offline'}
                </Badge>
                <Badge tone={health.data?.realtime ? 'success' : 'warning'}>
                  {health.data?.realtime ? 'Realtime on' : 'Realtime off'}
                </Badge>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Demo accounts" subtitle="Seeded for evaluation" icon="sparkles" />
            <div className="card-pad">
              <Table
                columns={[
                  { key: 'role', label: 'Role' },
                  { key: 'email', label: 'Email', render: (row) => <span className="font-mono text-[11px]">{row.email}</span> },
                ]}
                rows={DEMO_ACCOUNTS}
                keyField="email"
                dense
              />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                The shared demo password is <span className="kbd">Sample@123</span>. Rotate credentials before any public deployment.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Integration keys" subtitle="Server-side only" icon="lock" />
            <div className="card-pad space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Payment gateway keys live in <span className="kbd">server/.env</span>; the client never sees them.
              </p>
              <p className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                The AI assistant runs on a database-grounded provider by default and switches to OpenAI/Anthropic keys when configured.
              </p>
              <p className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Uploads are stored under <span className="kbd">server/uploads</span> and served read-only.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default AdminSettings;
