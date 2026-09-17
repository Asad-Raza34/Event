import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { formatDate, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader } from '../../components/ui';
import { LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import AccountSettings from '../../features/settings/AccountSettings';

const ExhibitorSettings = () => {
  const workspace = useApi(() => api.exhibitors.workspace(), []);
  const profile = workspace.data?.profile;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Your account, security, notification preferences and company verification."
        icon="settings"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <AccountSettings />
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Company snapshot" subtitle="Public information" icon="building" />
            <div className="card-pad">
              {workspace.loading ? (
                <LoadingState rows={1} />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{profile?.companyName}</p>
                    <Badge status={profile?.verificationStatus || 'pending'} dot />
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    {[
                      { label: 'Products', value: profile?.products?.length || 0 },
                      { label: 'Staff', value: profile?.staff?.length || 0 },
                      { label: 'Documents', value: profile?.documents?.length || 0 },
                      { label: 'Rating', value: `★ ${Number(profile?.avgRating || 0).toFixed(1)}` },
                      { label: 'Member since', value: formatDate(profile?.createdAt) },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500 dark:text-slate-400">{item.label}</dt>
                        <dd className="font-medium">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link to="/exhibitor/company" className="mt-4 block">
                    <Button variant="secondary" className="w-full" icon="pencil">
                      Edit company profile
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Verification" subtitle="Reviewed by organizers" icon="clipboard" />
            <div className="card-pad space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p className="flex items-start gap-2">
                <Icon name="file" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Upload your business licence and tax certificate to speed up verification.
              </p>
              {(profile?.documents || []).map((document) => (
                <div key={document._id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="truncate text-xs">{document.title}</span>
                  <Badge status={document.status} />
                </div>
              ))}
              {profile?.verificationNote && <p className="text-xs text-slate-500 dark:text-slate-400">Organizer note: {profile.verificationNote}</p>}
              <Link to="/exhibitor/company" className="block">
                <Button variant="secondary" className="w-full" icon="upload">
                  Manage documents
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Expo participation" subtitle="Active and past expos" icon="calendar" />
            <div className="card-pad">
              {(workspace.data?.applications || []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">You have not applied to an expo yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {workspace.data.applications.slice(0, 5).map((application) => (
                    <li key={application._id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{application.expo?.title}</span>
                      <Badge status={application.status} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Booth status: {titleCase(workspace.data?.booths?.[0]?.status || 'none')}
              </p>
              <Link to="/exhibitor/applications" className="mt-3 block">
                <Button variant="ghost" className="w-full" icon="clipboard">
                  Manage applications
                </Button>
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default ExhibitorSettings;
