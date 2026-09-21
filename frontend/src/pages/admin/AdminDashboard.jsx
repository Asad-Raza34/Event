import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { AreaTrend, BarsChart, DonutChart, RankedBars } from '../../components/charts';
import { compactNumber, formatCurrency, formatDate, formatDateTime, formatNumber, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, ProgressBar, StatCard } from '../../components/ui';
import { ErrorState, EmptyState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const QUICK_ACTIONS = [
  { label: 'Create expo', to: '/admin/expos', icon: 'plus' },
  { label: 'Review applications', to: '/admin/exhibitors', icon: 'clipboard' },
  { label: 'Allocate booths', to: '/admin/booths', icon: 'map' },
  { label: 'Build schedule', to: '/admin/sessions', icon: 'mic' },
  { label: 'Send announcement', to: '/admin/announcements', icon: 'megaphone' },
  { label: 'Check-in desk', to: '/admin/check-in', icon: 'qr' },
];

const AdminDashboard = () => {
  const { data, loading, error, reload } = useApi(() => api.analytics.admin({ days: 14 }), []);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Organizer dashboard" subtitle="Loading the latest platform activity…" />
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

  if (error) {
    return (
      <div>
        <PageHeader title="Organizer dashboard" />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const totals = data.totals;
  const trends = data.trends;
  const boothStatusData = ['occupied', 'reserved', 'available', 'maintenance']
    .map((status) => ({ name: titleCase(status), value: totals.booths?.[status] || 0 }))
    .filter((item) => item.value > 0);

  return (
    <div>
      <PageHeader
        title="Organizer dashboard"
        subtitle="Everything happening across your expos right now — registrations, booths, revenue and support."
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={reload}>
              Refresh
            </Button>
            <Link to="/admin/expos">
              <Button icon="plus">New expo</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total expos" value={formatNumber(totals.expos)} hint={`${totals.ongoingExpos} ongoing · ${totals.upcomingExpos} upcoming`} icon="calendar" />
        <StatCard label="Registered attendees" value={formatNumber(totals.registrations)} hint={`${totals.confirmedRegistrations} confirmed`} icon="users" tone="info" />
        <StatCard label="Exhibitors" value={formatNumber(totals.exhibitors)} hint={`${totals.booths?.total || 0} booths · ${totals.booths?.occupancyRate || 0}% occupied`} icon="building" tone="success" />
        <StatCard
          label="Revenue collected"
          value={formatCurrency(totals.revenue)}
          hint={`${totals.paidTransactions} paid transactions`}
          icon="credit-card"
          tone="warning"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Checked in" value={formatNumber(totals.attendance)} hint="QR passes scanned" icon="qr" tone="brand" />
        <StatCard label="Sessions" value={formatNumber(totals.sessions)} hint={`${formatNumber(totals.sessionSeats)} seats booked`} icon="mic" />
        <StatCard label="Appointments" value={formatNumber(Object.values(totals.appointments || {}).reduce((a, b) => a + b, 0))} hint={`${totals.appointments?.pending || 0} pending`} icon="handshake" tone="info" />
        <StatCard label="Avg. rating" value={Number(totals.averageRating || 0).toFixed(1)} hint={`${totals.reviews} reviews · ${totals.openTickets} open tickets`} icon="star" tone="warning" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Registration & attendance trend" subtitle="Last 14 days" icon="chart" />
          <div className="card-pad">
            <AreaTrend
              data={(trends.registrations || []).map((row, index) => ({
                label: row.label,
                registrations: row.count,
                attendance: trends.attendance?.[index]?.count || 0,
              }))}
              series={[
                { key: 'registrations', label: 'Registrations', color: '#6366f1' },
                { key: 'attendance', label: 'Check-ins', color: '#10b981' },
              ]}
              height={280}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Booth occupancy" subtitle={`${totals.booths?.occupancyRate || 0}% of booths taken`} icon="map" />
          <div className="card-pad">
            <DonutChart data={boothStatusData} height={260} />
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Occupancy</span>
                <span className="font-semibold">{totals.booths?.occupancyRate || 0}%</span>
              </div>
              <ProgressBar
                value={(totals.booths?.occupied || 0) + (totals.booths?.reserved || 0)}
                max={totals.booths?.total || 1}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue trend" subtitle="Paid transactions per day" icon="credit-card" />
          <div className="card-pad">
            <BarsChart
              data={(trends.revenue || []).map((row) => ({ label: row.label, revenue: Math.round(row.revenue || 0) }))}
              series={[{ key: 'revenue', label: 'Revenue', color: '#06b6d4' }]}
              height={240}
              valueFormatter={(value) => formatCurrency(value)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Most popular sessions" subtitle="By registrations" icon="mic" />
          <div className="card-pad">
            {data.popularSessions.length === 0 ? (
              <EmptyState icon="mic" title="No session registrations yet" className="border-0" />
            ) : (
              <RankedBars
                items={data.popularSessions.map((session) => ({ label: session.title, value: session.registeredCount || 0 }))}
                height={240}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent registrations"
            subtitle="Latest attendees joining your expos"
            icon="users"
            action={
              <Link to="/admin/attendees">
                <Button size="xs" variant="secondary">
                  View all
                </Button>
              </Link>
            }
          />
          <div className="divide-soft">
            {data.recent.registrations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No registrations yet.</p>
            ) : (
              data.recent.registrations.map((registration) => (
                <div key={registration._id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {registration.user?.name?.slice(0, 1) || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{registration.user?.name || registration.attendeeDetails?.fullName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {registration.expo?.title} · {formatDateTime(registration.createdAt)}
                    </p>
                  </div>
                  <Badge status={registration.status} dot />
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
          <CardHeader
            title="Exhibitor applications"
            icon="clipboard"
            action={
              <Link to="/admin/exhibitors">
                <Button size="xs" variant="ghost">
                  Review
                </Button>
              </Link>
            }
          />
          <div className="divide-soft">
            {data.recent.applications.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No applications yet.</p>
            ) : (
              data.recent.applications.map((application) => (
                <div key={application._id} className="flex items-center gap-3 px-5 py-3">
                  {application.exhibitor?.logo ? (
                    <img src={mediaUrl(application.exhibitor.logo)} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <Icon name="building" className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{application.exhibitor?.companyName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{application.expo?.title}</p>
                  </div>
                  <Badge status={application.status} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent payments" icon="credit-card" />
          <div className="divide-soft">
            {data.recent.payments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No payments yet.</p>
            ) : (
              data.recent.payments.map((payment) => (
                <div key={payment._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.user?.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{titleCase(payment.purpose)}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(payment.total, payment.currency)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Support tickets"
            icon="lifebuoy"
            action={
              <Link to="/admin/support">
                <Button size="xs" variant="ghost">
                  Open inbox
                </Button>
              </Link>
            }
          />
          <div className="divide-soft">
            {data.recent.tickets.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No open tickets 🎉</p>
            ) : (
              data.recent.tickets.map((ticket) => (
                <div key={ticket._id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ticket.subject}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{ticket.user?.name}</p>
                  </div>
                  <Badge status={ticket.status} />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming sessions" subtitle="Next on the programme" icon="clock" />
          <div className="divide-soft">
            {data.upcomingSessions.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No sessions scheduled.</p>
            ) : (
              data.upcomingSessions.map((session) => (
                <div key={session._id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <span className="text-[10px] font-semibold uppercase">{formatDate(session.date, { month: 'short' })}</span>
                    <span className="text-sm font-bold leading-none">{new Date(session.date).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{session.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {session.startTime} · {session.location?.room || 'Room TBA'} · {session.expo?.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{session.registeredCount || 0} booked</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Booth traffic" subtitle="Most viewed booths" icon="eye" />
          <div className="divide-soft">
            {data.boothTraffic.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No booth traffic recorded yet.</p>
            ) : (
              data.boothTraffic.map((booth) => (
                <div key={booth._id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-16 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold dark:bg-slate-800">
                    {booth.zone}-{booth.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{booth.exhibitor?.companyName || 'Unassigned'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{booth.expo?.title}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold">{compactNumber(booth.traffic?.views || 0)} views</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
