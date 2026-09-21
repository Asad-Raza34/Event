import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { AreaTrend, BarsChart, DonutChart, RankedBars } from '../../components/charts';
import { compactNumber, formatCurrency, formatNumber, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Card, CardHeader, ProgressBar, Select, StatCard, Table, Tabs } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const AdminAnalytics = () => {
  const [params, setParams] = useSearchParams();
  const expoId = params.get('expo') || '';
  const [range, setRange] = useState('14');
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true', sort: '-startDate' }), []);
  const overview = useApi(() => api.analytics.admin({ days: Number(range) }), [range]);
  const expoAnalytics = useApi(() => api.expos.analytics(expoId, { days: Number(range) }), [expoId, range], { enabled: Boolean(expoId) });

  const totals = overview.data?.totals;
  const trends = overview.data?.trends;
  const expoTotals = expoAnalytics.data?.totals;

  const popularity = useApi(
    () => api.expos.sessionPopularity(expoId),
    [expoId],
    { enabled: Boolean(expoId) },
  );

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Registration, attendance, revenue, booth and session performance across the platform."
        icon="chart"
        actions={
          <>
            <Select
              className="min-w-[220px]"
              value={expoId}
              placeholder="All expos"
              options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value) next.set('expo', event.target.value);
                else next.delete('expo');
                setParams(next, { replace: true });
              }}
              aria-label="Select expo"
            />
            <Select
              className="w-[150px]"
              value={range}
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '14', label: 'Last 14 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
              ]}
              onChange={(event) => setRange(event.target.value)}
              aria-label="Select time range"
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registrations" value={formatNumber(totals?.registrations || 0)} hint={`${totals?.confirmedRegistrations || 0} confirmed`} icon="users" />
        <StatCard label="Attendance" value={formatNumber(totals?.attendance || 0)} hint="QR check-ins" icon="qr" tone="success" />
        <StatCard label="Revenue" value={formatCurrency(totals?.revenue || 0)} hint={`${totals?.paidTransactions || 0} paid`} icon="credit-card" tone="warning" />
        <StatCard
          label="Booth occupancy"
          value={`${totals?.booths?.occupancyRate || 0}%`}
          hint={`${totals?.booths?.total || 0} booths`}
          icon="map"
          tone="info"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Registration & attendance trend" subtitle={`Last ${range} days`} icon="chart" />
          <div className="card-pad">
            <AreaTrend
              data={(trends?.registrations || []).map((row, index) => ({
                label: row.label,
                registrations: row.count,
                attendance: trends?.attendance?.[index]?.count || 0,
              }))}
              series={[
                { key: 'registrations', label: 'Registrations' },
                { key: 'attendance', label: 'Check-ins', color: '#10b981' },
              ]}
              height={260}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Expo status mix" subtitle="Across all expos" icon="calendar" />
          <div className="card-pad">
            <DonutChart
              data={Object.entries(totals?.exposByStatus || {}).map(([status, count]) => ({ name: titleCase(status), value: count }))}
              height={240}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Booth occupancy by zone" subtitle="Platform wide" icon="layers" />
          <div className="card-pad">
            {(overview.data?.boothOccupancyByZone || []).length === 0 ? (
              <EmptyState icon="map" title="No booths yet" className="border-0" />
            ) : (
              <BarsChart
                data={(overview.data?.boothOccupancyByZone || []).map((zone) => ({ label: `Zone ${zone.zone}`, occupied: zone.occupied, available: zone.available }))}
                series={[
                  { key: 'occupied', label: 'Taken', color: '#6366f1' },
                  { key: 'available', label: 'Available', color: '#10b981' },
                ]}
                height={250}
                stacked
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top exhibitors by booth visits" subtitle="Last 30 days" icon="building" />
          <div className="card-pad">
            {(overview.data?.topExhibitors || []).length === 0 ? (
              <EmptyState icon="building" title="No booth visits recorded" className="border-0" />
            ) : (
              <RankedBars
                items={(overview.data?.topExhibitors || []).map((item) => ({ label: item.name || 'Exhibitor', value: item.visits }))}
                height={250}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader title="Expo performance" subtitle="Compare registrations, revenue and attendance" icon="chart" />
          <div className="card-pad">
            <Table
              columns={[
                { key: 'title', label: 'Expo', render: (row) => <span className="text-sm font-medium">{row.title}</span> },
                { key: 'registrations', label: 'Registrations', render: (row) => formatNumber(row.stats?.registeredCount || 0) },
                { key: 'views', label: 'Views', render: (row) => formatNumber(row.stats?.viewCount || 0) },
                { key: 'rating', label: 'Rating', render: (row) => Number(row.stats?.averageRating || 0).toFixed(1) },
                {
                  key: 'capacity',
                  label: 'Capacity used',
                  render: (row) => {
                    const used = row.maxAttendees ? Math.round(((row.stats?.registeredCount || 0) / row.maxAttendees) * 100) : 0;
                    return (
                      <div className="w-32">
                        <ProgressBar value={used} max={100} tone={used > 85 ? 'warning' : 'brand'} />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{used}%</p>
                      </div>
                    );
                  },
                },
              ]}
              rows={expos.data || []}
              empty={<EmptyState icon="calendar" title="No expos yet" className="border-0" />}
            />
          </div>
        </Card>
      </div>

      {expoId && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{expoAnalytics.data?.expo?.title || 'Expo analytics'}</h2>
            <Tabs
              active="overview"
              onChange={() => {}}
              tabs={[{ value: 'overview', label: 'Event performance', icon: 'chart' }]}
            />
          </div>

          {expoAnalytics.loading ? (
            <LoadingState rows={2} />
          ) : expoAnalytics.error ? (
            <ErrorState error={expoAnalytics.error} onRetry={expoAnalytics.reload} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Registrations" value={formatNumber(expoTotals?.registrations || 0)} icon="users" />
                <StatCard label="Attendance rate" value={`${expoTotals?.attendanceRate || 0}%`} hint={`${expoTotals?.attendance || 0} checked in`} icon="qr" tone="success" />
                <StatCard label="Revenue" value={formatCurrency(expoTotals?.revenue || 0)} hint={`${expoTotals?.transactions || 0} transactions`} icon="credit-card" tone="warning" />
                <StatCard label="Average rating" value={Number(expoTotals?.averageRating || 0).toFixed(1)} hint={`${expoTotals?.reviews || 0} reviews`} icon="star" tone="info" />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Registrations per day" icon="chart" />
                  <div className="card-pad">
                    <AreaTrend
                      data={(expoAnalytics.data?.trends?.registrations || []).map((row) => ({ label: row.label, count: row.count }))}
                      series={[{ key: 'count', label: 'Registrations' }]}
                      height={240}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Booth visits per day" icon="eye" />
                  <div className="card-pad">
                    <AreaTrend
                      data={(expoAnalytics.data?.trends?.boothVisits || []).map((row) => ({ label: row.label, count: row.count }))}
                      series={[{ key: 'count', label: 'Booth visits', color: '#06b6d4' }]}
                      height={240}
                    />
                  </div>
                </Card>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Session types" subtitle="Sessions, seats and capacity" icon="mic" />
                  <div className="card-pad">
                    <Table
                      columns={[
                        { key: 'type', label: 'Type', render: (row) => titleCase(row._id) },
                        { key: 'count', label: 'Sessions', render: (row) => row.count },
                        { key: 'seats', label: 'Seats booked', render: (row) => compactNumber(row.seats) },
                        { key: 'capacity', label: 'Capacity', render: (row) => compactNumber(row.capacity) },
                      ]}
                      rows={expoAnalytics.data?.sessionBreakdown || []}
                      keyField="_id"
                      empty={<EmptyState icon="mic" title="No sessions" className="border-0" />}
                    />
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Most popular sessions" subtitle="By registrations" icon="star" />
                  <div className="card-pad">
                    {(popularity.data || []).length === 0 ? (
                      <EmptyState icon="mic" title="No session registrations yet" className="border-0" />
                    ) : (
                      <RankedBars
                        items={(popularity.data || []).map((session) => ({ label: session.title, value: session.registeredCount || 0 }))}
                        height={260}
                      />
                    )}
                  </div>
                </Card>
              </div>

              <Card className="mt-4">
                <CardHeader title="Expo summary" icon="info" />
                <div className="card-pad grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Exhibitors approved', value: formatNumber(expoTotals?.exhibitors || 0), icon: 'building' },
                    { label: 'Sessions', value: formatNumber(expoTotals?.sessions || 0), icon: 'mic' },
                    { label: 'Session seats', value: formatNumber(expoTotals?.sessionSeats || 0), icon: 'users2' },
                    { label: 'Appointments', value: formatNumber(Object.values(expoTotals?.appointments || {}).reduce((a, b) => a + b, 0)), icon: 'handshake' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Icon name={item.icon} className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="text-lg font-bold">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;
