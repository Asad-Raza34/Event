import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { AreaTrend, BarsChart, DonutChart, RankedBars } from '../../components/charts';
import { compactNumber, formatCurrency, formatDate, formatNumber, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Card, CardHeader, ProgressBar, Select, StatCard, Table } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const ExhibitorAnalytics = () => {
  const [days, setDays] = useState('14');
  const analytics = useApi(() => api.analytics.exhibitor({ days: Number(days) }), [days]);

  if (analytics.loading && !analytics.data) return <LoadingState rows={3} />;
  if (analytics.error) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <ErrorState error={analytics.error} onRetry={analytics.reload} />
      </div>
    );
  }

  const totals = analytics.data?.totals || {};
  const trends = analytics.data?.trends?.boothVisits || [];
  const visitsBySource = analytics.data?.visitsBySource || [];
  const ratingBreakdown = analytics.data?.ratingBreakdown || [];
  const booths = analytics.data?.booths || [];

  const conversionRate = totals.boothVisits ? Math.round(((totals.appointments || 0) / totals.boothVisits) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="How attendees find, visit and engage with your booth — plus the meetings it generates."
        icon="chart"
        actions={
          <Select
            className="w-[160px]"
            value={days}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '14', label: 'Last 14 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
            onChange={(event) => setDays(event.target.value)}
            aria-label="Select time range"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Booth visits" value={formatNumber(totals.boothVisits || 0)} hint={`${totals.uniqueVisitors || 0} unique attendees`} icon="eye" />
        <StatCard label="Profile views" value={formatNumber(totals.profileViews || 0)} hint={`${totals.products || 0} products listed`} icon="building" tone="info" />
        <StatCard label="Appointments" value={formatNumber(totals.appointments || 0)} hint={`${conversionRate}% of booth visits`} icon="handshake" tone="warning" />
        <StatCard label="Average rating" value={Number(totals.averageRating || 0).toFixed(1)} hint={`${totals.reviews || 0} reviews`} icon="star" tone="success" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Visitor trend" subtitle={`Booth visits over the last ${days} days`} icon="chart" />
          <div className="card-pad">
            <AreaTrend
              data={trends.map((row) => ({ label: row.label, count: row.count }))}
              series={[{ key: 'count', label: 'Booth visits' }]}
              height={260}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Where visitors come from" icon="compass" />
          <div className="card-pad">
            <DonutChart data={visitsBySource.map((item) => ({ name: titleCase(item.source || 'direct'), value: item.count }))} height={250} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rating distribution" subtitle="How attendees rate your company" icon="star" />
          <div className="card-pad">
            {ratingBreakdown.length === 0 ? (
              <EmptyState icon="star" title="No ratings yet" className="border-0" />
            ) : (
              <RankedBars items={ratingBreakdown.map((item) => ({ label: `${item.star} star`, value: item.count }))} height={240} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Booth performance" subtitle="Traffic per booth" icon="map" />
          <div className="card-pad">
            <BarsChart
              data={booths.map((booth) => ({
                label: `${booth.zone}-${booth.number}`,
                views: booth.traffic?.views || 0,
                checkIns: booth.traffic?.checkIns || 0,
              }))}
              series={[
                { key: 'views', label: 'Views' },
                { key: 'checkIns', label: 'Scans', color: '#10b981' },
              ]}
              height={240}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Booth breakdown" subtitle="Views, scans and meetings" icon="clipboard" />
          <div className="card-pad">
            <Table
              columns={[
                { key: 'number', label: 'Booth', render: (row) => `${row.zone}-${row.number}` },
                { key: 'expo', label: 'Expo', render: (row) => <span className="text-xs">{row.expo?.title}</span> },
                { key: 'views', label: 'Views', render: (row) => row.traffic?.views || 0 },
                { key: 'checkIns', label: 'Scans', render: (row) => row.traffic?.checkIns || 0 },
                { key: 'appointments', label: 'Meetings', render: (row) => row.traffic?.appointments || 0 },
                { key: 'price', label: 'Fee', render: (row) => formatCurrency(row.price, row.currency) },
              ]}
              rows={booths}
              empty={<EmptyState icon="map" title="No booths yet" className="border-0" />}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Engagement funnel" subtitle="From discovery to meetings" icon="filter" />
          <div className="card-pad space-y-4">
            {[
              { label: 'Profile views', value: totals.profileViews || 0, tone: 'brand' },
              { label: 'Booth visits', value: totals.boothVisits || 0, tone: 'brand' },
              { label: 'Unique attendees', value: totals.uniqueVisitors || 0, tone: 'brand' },
              { label: 'Appointments booked', value: totals.appointments || 0, tone: 'success' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                  <span className="font-semibold">{compactNumber(item.value)}</span>
                </div>
                <ProgressBar
                  className="mt-1.5"
                  value={item.value}
                  max={Math.max(totals.profileViews || 1, totals.boothVisits || 1, 1)}
                  tone={item.tone}
                />
              </div>
            ))}
            <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Appointments booked per booth visit is your strongest conversion signal ({conversionRate}% right now).
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Upcoming appointments" subtitle="Your next meetings" icon="handshake" />
        <div className="card-pad">
          <Table
            columns={[
              { key: 'topic', label: 'Topic', render: (row) => <span className="text-sm font-medium">{row.topic}</span> },
              { key: 'attendee', label: 'Attendee', render: (row) => row.attendee?.name || '—' },
              { key: 'when', label: 'When', render: (row) => `${formatDate(row.date)} · ${row.startTime}` },
              { key: 'expo', label: 'Expo', render: (row) => <span className="text-xs">{row.expo?.title}</span> },
              { key: 'status', label: 'Status', render: (row) => titleCase(row.status) },
            ]}
            rows={analytics.data?.upcomingAppointments || []}
            empty={<EmptyState icon="handshake" title="No upcoming appointments" className="border-0" />}
          />
        </div>
      </Card>
    </div>
  );
};

export default ExhibitorAnalytics;
