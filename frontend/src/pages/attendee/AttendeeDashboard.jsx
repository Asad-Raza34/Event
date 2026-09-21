import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { ActivityPie } from '../../components/charts';
import { formatCurrency, formatDate, formatDateTime, formatTime, mediaUrl, relativeTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, StatCard, StarRating } from '../../components/ui';
import { EmptyState, ErrorState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const QUICK_ACTIONS = [
  { label: 'Browse expos', to: '/expos', icon: 'compass' },
  { label: 'Event pass & QR', to: '/attendee/pass', icon: 'qr' },
  { label: 'My sessions', to: '/attendee/sessions', icon: 'mic' },
  { label: 'Book a meeting', to: '/exhibitors', icon: 'handshake' },
  { label: 'Interactive floor plan', to: '/attendee/floor-plan', icon: 'layers' },
  { label: 'Support', to: '/attendee/support', icon: 'lifebuoy' },
];

const AttendeeDashboard = () => {
  const { user } = useAuth();
  const activity = useApi(() => api.registrations.activity(), []);
  const notifications = useApi(() => api.notifications.list({ limit: 4 }), []);

  if (activity.loading && !activity.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="My event dashboard" subtitle="Loading your activity…" />
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

  if (activity.error) {
    return (
      <div>
        <PageHeader title="My event dashboard" />
        <ErrorState error={activity.error} onRetry={activity.reload} />
      </div>
    );
  }

  const stats = activity.data.stats || {};
  const registrations = activity.data.registrations || [];
  const sessions = activity.data.sessions || [];
  const appointments = activity.data.appointments || [];
  const checkIns = activity.data.checkIns || [];
  const payments = activity.data.payments || [];

  const upcomingExpos = registrations.filter(
    (registration) => registration.expo && new Date(registration.expo.startDate) >= new Date(new Date().toDateString()) && registration.status !== 'cancelled',
  );
  const nextSessions = sessions
    .filter((entry) => entry.session && entry.registered)
    .sort((a, b) => new Date(a.session.date) - new Date(b.session.date))
    .slice(0, 4);
  const nextAppointments = appointments
    .filter((appointment) => ['pending', 'confirmed'].includes(appointment.status))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);
  const activePass = registrations.find((registration) => ['confirmed', 'attended'].includes(registration.status));

  return (
    <div>
      <PageHeader
        title={`Hi ${user?.name?.split(' ')[0] || 'there'} 👋`}
        subtitle="Your passes, agenda, meetings and spend — everything about your event in one place."
        icon="grid"
        actions={
          <>
            <Link to="/expos">
              <Button variant="secondary" icon="compass">
                Browse expos
              </Button>
            </Link>
            <Link to="/attendee/pass">
              <Button icon="qr">Open event pass</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Expos registered" value={stats.expos || 0} hint={`${stats.upcoming || 0} upcoming`} icon="calendar" />
        <StatCard label="Sessions on my agenda" value={stats.sessions || 0} hint={`${stats.bookmarks || 0} bookmarked`} icon="mic" tone="info" />
        <StatCard label="Appointments" value={stats.appointments || 0} hint={`${stats.checkIns || 0} check-ins`} icon="handshake" tone="warning" />
        <StatCard label="Total spend" value={formatCurrency(stats.totalSpent || 0)} hint={`${payments.length} transactions`} icon="credit-card" tone="success" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Upcoming expos"
            subtitle="Your next events and their status"
            icon="calendar"
            action={
              <Link to="/attendee/expos">
                <Button size="xs" variant="secondary">
                  All my expos
                </Button>
              </Link>
            }
          />
          <div className="divide-soft">
            {upcomingExpos.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No upcoming expos"
                message="Browse the catalogue and register for your next event."
                action={
                  <Link to="/expos">
                    <Button size="sm" icon="compass">
                      Browse expos
                    </Button>
                  </Link>
                }
                className="border-0"
              />
            ) : (
              upcomingExpos.slice(0, 4).map((registration) => (
                <div key={registration._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  {registration.expo?.banner ? (
                    <img src={mediaUrl(registration.expo.banner)} alt="" className="h-12 w-16 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                      <Icon name="calendar" className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{registration.expo?.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(registration.expo?.startDate)} · {registration.expo?.location?.venue || 'Venue TBA'}
                    </p>
                  </div>
                  <Badge status={registration.status} dot />
                  <Link to={`/expos/${registration.expo?.slug || registration.expo?._id}`}>
                    <Button size="xs" variant="secondary" icon="eye">
                      Details
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="My pass" subtitle="Show this QR at the door" icon="qr" />
          <div className="card-pad text-center">
            {activePass ? (
              <>
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <Icon name="qr" className="h-9 w-9" />
                </span>
                <p className="mt-3 text-sm font-medium">{activePass.expo?.title}</p>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{activePass.passCode}</p>
                <Link to="/attendee/pass" className="mt-4 block">
                  <Button className="w-full" icon="qr">
                    Open full pass
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <Icon name="ticket" className="h-8 w-8" />
                </span>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No active pass yet — register for an expo to get one.</p>
                <Link to="/expos" className="mt-4 block">
                  <Button className="w-full" icon="compass">
                    Find an expo
                  </Button>
                </Link>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Next sessions on my agenda"
            icon="mic"
            action={
              <Link to="/attendee/sessions">
                <Button size="xs" variant="ghost">
                  Agenda
                </Button>
              </Link>
            }
          />
          <div className="divide-soft">
            {nextSessions.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No sessions registered yet — browse the programme and add a few.
              </p>
            ) : (
              nextSessions.map((entry) => (
                <div key={entry._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <span className="text-[10px] font-semibold uppercase">{formatDate(entry.session.date, { month: 'short' })}</span>
                    <span className="text-sm font-bold leading-none">{new Date(entry.session.date).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.session.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {formatTime(entry.session.startTime)} · {entry.session.location?.room || 'Room TBA'} · {entry.session.expo?.title}
                    </p>
                  </div>
                  {entry.bookmarked && <Badge tone="info">Bookmarked</Badge>}
                  {entry.status === 'attended' && <Badge tone="success">Attended</Badge>}
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
            <Link to="/attendee/appointments">
              <Button size="xs" variant="ghost">All</Button>
            </Link>
          } />
          <div className="divide-soft">
            {nextAppointments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No meetings booked.</p>
            ) : (
              nextAppointments.map((appointment) => (
                <div key={appointment._id} className="px-5 py-3">
                  <p className="truncate text-sm font-medium">{appointment.topic}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {appointment.exhibitor?.companyName} · {formatDate(appointment.date)} {formatTime(appointment.startTime)}
                  </p>
                  <Badge className="mt-1" status={appointment.status} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Check-in history" icon="qr" />
          <div className="divide-soft">
            {checkIns.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No check-ins yet.</p>
            ) : (
              checkIns.slice(0, 4).map((checkIn) => (
                <div key={checkIn._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{checkIn.expo?.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(checkIn.checkedInAt)}</p>
                  </div>
                  <Badge tone="info">{titleCase(checkIn.type)}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Latest notifications" icon="bell" action={
            <Link to="/attendee/notifications">
              <Button size="xs" variant="ghost">Inbox</Button>
            </Link>
          } />
          <div className="divide-soft">
            {(notifications.data || []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">You are all caught up.</p>
            ) : (
              notifications.data.map((notification) => (
                <div key={notification._id} className="px-5 py-3">
                  <p className="truncate text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{relativeTime(notification.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="My activity mix" subtitle="Where your time goes" icon="chart" />
          <div className="card-pad">
            <ActivityPie
              data={[
                { name: 'Sessions', value: stats.sessions || 0 },
                { name: 'Bookmarks', value: stats.bookmarks || 0 },
                { name: 'Appointments', value: stats.appointments || 0 },
                { name: 'Check-ins', value: stats.checkIns || 0 },
              ]}
              height={240}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent payments" icon="credit-card" action={
            <Link to="/attendee/payments">
              <Button size="xs" variant="ghost">Ledger</Button>
            </Link>
          } />
          <div className="divide-soft">
            {payments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No payments yet.</p>
            ) : (
              payments.slice(0, 5).map((payment) => (
                <div key={payment._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.description || titleCase(payment.purpose)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(payment.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(payment.total, payment.currency)}</p>
                    <Badge status={payment.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Icon name="star" className="h-3.5 w-3.5" /> Rate the exhibitors and sessions you visit to help other attendees.
        <StarRating value={0} showValue={false} size="sm" className="opacity-50" />
      </p>
    </div>
  );
};

export default AttendeeDashboard;
