import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { AreaTrend, DonutChart, RankedBars } from '../../components/charts';
import { formatCurrency, formatDate, formatDateTime, formatTime, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, ProgressBar, StatCard, StarRating } from '../../components/ui';
import { EmptyState, ErrorState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const QUICK_ACTIONS = [
  { label: 'Edit company profile', to: '/exhibitor/company', icon: 'building' },
  { label: 'Manage products', to: '/exhibitor/products', icon: 'box' },
  { label: 'Apply to an expo', to: '/exhibitor/applications', icon: 'clipboard' },
  { label: 'Set availability', to: '/exhibitor/availability', icon: 'clock' },
  { label: 'Select a booth', to: '/exhibitor/floor-plan', icon: 'map' },
  { label: 'Open messages', to: '/exhibitor/messages', icon: 'chat' },
];

const ExhibitorDashboard = () => {
  const { user } = useAuth();
  const workspace = useApi(() => api.exhibitors.workspace(), []);
  const analytics = useApi(() => api.analytics.exhibitor({ days: 14 }), []);

  if (workspace.loading && !workspace.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Exhibitor dashboard" subtitle="Loading your workspace…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="card-pad">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton mt-3 h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (workspace.error) {
    return (
      <div>
        <PageHeader title="Exhibitor dashboard" />
        <ErrorState error={workspace.error} onRetry={workspace.reload} />
      </div>
    );
  }

  const profile = workspace.data.profile;
  const products = workspace.data.products || [];
  const applications = workspace.data.applications || [];
  const booths = workspace.data.booths || [];
  const reviews = workspace.data.reviews || [];
  const totals = analytics.data?.totals || {};
  const visits = analytics.data?.trends?.boothVisits || [];

  const completion = [
    Boolean(profile.description),
    Boolean(profile.logo),
    products.length > 0,
    Boolean(profile.contact?.phone),
    profile.staff?.length > 0,
    profile.documents?.length > 0,
  ].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile.companyName || user?.name}`}
        subtitle="Your booth, appointments, leads and analytics at a glance."
        icon="grid"
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={() => {
              workspace.reload();
              analytics.reload();
            }}>
              Refresh
            </Button>
            <Link to="/exhibitor/applications">
              <Button icon="clipboard">Apply to an expo</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Booth visits" value={totals.boothVisits ?? 0} hint={`${totals.uniqueVisitors ?? 0} unique visitors`} icon="eye" />
        <StatCard label="Profile views" value={totals.profileViews ?? profile.profileViews ?? 0} hint={`${products.length} products listed`} icon="building" tone="info" />
        <StatCard
          label="Appointments"
          value={totals.appointments ?? 0}
          hint={`${totals.appointmentsByStatus?.pending || 0} awaiting your reply`}
          icon="handshake"
          tone="warning"
        />
        <StatCard label="Average rating" value={Number(totals.averageRating || profile.avgRating || 0).toFixed(1)} hint={`${totals.reviews ?? reviews.length} reviews`} icon="star" tone="success" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Booth traffic" subtitle="Visits recorded over the last 14 days" icon="chart" />
          <div className="card-pad">
            <AreaTrend
              data={visits.map((row) => ({ label: row.label, count: row.count }))}
              series={[{ key: 'count', label: 'Booth visits' }]}
              height={250}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Profile completeness" subtitle={`${completion} of 6 steps complete`} icon="check" />
          <div className="card-pad space-y-4">
            <ProgressBar value={completion} max={6} tone={completion < 4 ? 'warning' : 'success'} showLabel />
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Company description', done: Boolean(profile.description), to: '/exhibitor/company' },
                { label: 'Company logo', done: Boolean(profile.logo), to: '/exhibitor/company' },
                { label: 'Products or services', done: products.length > 0, to: '/exhibitor/products' },
                { label: 'Contact details', done: Boolean(profile.contact?.phone), to: '/exhibitor/company' },
                { label: 'Booth staff', done: profile.staff?.length > 0, to: '/exhibitor/company' },
                { label: 'Verification documents', done: profile.documents?.length > 0, to: '/exhibitor/company' },
              ].map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Icon
                      name={item.done ? 'check' : 'alert'}
                      className={`h-4 w-4 ${item.done ? 'text-emerald-500' : 'text-amber-500'}`}
                    />
                    <span className={item.done ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}>{item.label}</span>
                  </span>
                  {!item.done && (
                    <Link to={item.to} className="link text-xs">
                      Complete
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="My booths"
            subtitle="Assigned and requested spaces"
            icon="map"
            action={
              <Link to="/exhibitor/booth">
                <Button size="xs" variant="secondary">
                  Manage
                </Button>
              </Link>
            }
          />
          <div className="divide-soft">
            {booths.length === 0 ? (
              <EmptyState
                icon="map"
                title="No booth yet"
                message="Apply to an expo, then reserve a booth from the interactive floor plan."
                action={
                  <Link to="/exhibitor/floor-plan">
                    <Button size="sm" icon="layers">
                      Open floor plan
                    </Button>
                  </Link>
                }
                className="border-0"
              />
            ) : (
              booths.map((booth) => (
                <div key={booth._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {booth.zone}-{booth.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{booth.expo?.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {titleCase(booth.size)} · {formatCurrency(booth.price, booth.currency)} · {booth.traffic?.views || 0} views
                    </p>
                  </div>
                  <Badge status={booth.status} dot />
                  <Link to={`/expos/${booth.expo?.slug || booth.expo?._id}`}>
                    <Button size="xs" variant="secondary" icon="eye">
                      Expo
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick actions" icon="spark" />
          <div className="card-pad grid gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.to} to={action.to}>
                <Button variant="secondary" className="w-full justify-start" icon={action.icon}>
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Upcoming appointments" icon="handshake" action={
            <Link to="/exhibitor/appointments">
              <Button size="xs" variant="ghost">All</Button>
            </Link>
          } />
          <div className="divide-soft">
            {(analytics.data?.upcomingAppointments || []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No upcoming meetings.</p>
            ) : (
              analytics.data.upcomingAppointments.map((appointment) => (
                <div key={appointment._id} className="px-5 py-3">
                  <p className="truncate text-sm font-medium">{appointment.topic}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(appointment.date)} · {formatTime(appointment.startTime)} · {appointment.attendee?.name}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Applications" subtitle="Expos you applied to" icon="clipboard" action={
            <Link to="/exhibitor/applications">
              <Button size="xs" variant="ghost">Manage</Button>
            </Link>
          } />
          <div className="divide-soft">
            {applications.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No applications yet.</p>
            ) : (
              applications.slice(0, 4).map((application) => (
                <div key={application._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{application.expo?.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(application.createdAt)}</p>
                  </div>
                  <Badge status={application.status} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent reviews" icon="star" action={
            <Link to="/exhibitor/reviews">
              <Button size="xs" variant="ghost">All</Button>
            </Link>
          } />
          <div className="divide-soft">
            {reviews.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No reviews yet.</p>
            ) : (
              reviews.slice(0, 4).map((review) => (
                <div key={review._id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{review.author?.name || 'Attendee'}</p>
                    <StarRating value={review.rating} size="sm" showValue={false} />
                  </div>
                  {review.comment && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{review.comment}</p>}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Visitor sources" subtitle="Where booth visits come from" icon="compass" />
          <div className="card-pad">
            <DonutChart
              data={(analytics.data?.visitsBySource || []).map((item) => ({ name: titleCase(item.source || 'direct'), value: item.count }))}
              height={240}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Rating breakdown" subtitle="What attendees think" icon="star" />
          <div className="card-pad">
            <RankedBars
              items={(analytics.data?.ratingBreakdown || []).map((item) => ({ label: `${item.star} star`, value: item.count }))}
              height={240}
            />
          </div>
        </Card>
      </div>

      {profile.logo && <p className="sr-only">Company logo: {mediaUrl(profile.logo)}</p>}
    </div>
  );
};

export default ExhibitorDashboard;
