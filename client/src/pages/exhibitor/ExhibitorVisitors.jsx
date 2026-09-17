import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { AreaTrend, DonutChart } from '../../components/charts';
import { formatDate, formatNumber, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Card, CardHeader, Select, StatCard, Table } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const ExhibitorVisitors = () => {
  const [days, setDays] = useState('30');
  const analytics = useApi(() => api.analytics.exhibitor({ days: Number(days) }), [days]);
  const workspace = useApi(() => api.exhibitors.workspace(), []);

  if (analytics.loading && !analytics.data) return <LoadingState rows={3} />;
  if (analytics.error) {
    return (
      <div>
        <PageHeader title="Visitors" />
        <ErrorState error={analytics.error} onRetry={analytics.reload} />
      </div>
    );
  }

  const totals = analytics.data?.totals || {};
  const trends = analytics.data?.trends?.boothVisits || [];
  const sources = analytics.data?.visitsBySource || [];
  const booths = analytics.data?.booths || [];
  const reviews = workspace.data?.reviews || [];

  return (
    <div>
      <PageHeader
        title="Booth visitors"
        subtitle="Who stopped by your stand, how they found you and the leads your team generated."
        icon="eye"
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
        <StatCard label="Total booth visits" value={formatNumber(totals.boothVisits || 0)} icon="eye" />
        <StatCard label="Unique visitors" value={formatNumber(totals.uniqueVisitors || 0)} hint="Distinct attendees recorded" icon="users" tone="info" />
        <StatCard label="QR scans at the stand" value={formatNumber(totals.checkIns || 0)} hint="Scanned booth codes" icon="qr" tone="success" />
        <StatCard label="Meetings booked" value={formatNumber(totals.appointments || 0)} hint="Appointments from visits" icon="handshake" tone="warning" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Visit trend" subtitle={`Daily booth visits · last ${days} days`} icon="chart" />
          <div className="card-pad">
            <AreaTrend
              data={trends.map((row) => ({ label: row.label, count: row.count }))}
              series={[{ key: 'count', label: 'Booth visits' }]}
              height={260}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Traffic sources" subtitle="How visitors reached your booth" icon="compass" />
          <div className="card-pad">
            <DonutChart data={sources.map((item) => ({ name: titleCase(item.source || 'direct'), value: item.count }))} height={250} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Visits per booth" subtitle="Scan and view counts" icon="map" />
          <div className="card-pad">
            <Table
              columns={[
                { key: 'number', label: 'Booth', render: (row) => `${row.zone}-${row.number}` },
                { key: 'expo', label: 'Expo', render: (row) => <span className="text-xs">{row.expo?.title}</span> },
                { key: 'views', label: 'Views', render: (row) => row.traffic?.views || 0 },
                { key: 'checkIns', label: 'Scans', render: (row) => row.traffic?.checkIns || 0 },
                { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
              ]}
              rows={booths}
              empty={<EmptyState icon="map" title="No booths yet" className="border-0" />}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Visitor feedback" subtitle="Recent reviews from attendees" icon="star" />
          <div className="divide-soft">
            {reviews.length === 0 ? (
              <EmptyState icon="star" title="No reviews yet" message="Attendees can review your company from your public profile." className="border-0" />
            ) : (
              reviews.slice(0, 6).map((review) => (
                <div key={review._id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{review.author?.name || 'Attendee'}</p>
                    <span className="text-xs font-semibold">★ {review.rating}</span>
                  </div>
                  {review.comment && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{review.comment}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">{formatDate(review.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4 card-pad">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="info" className="h-4 w-4 text-brand-600 dark:text-brand-400" /> How booth visits are recorded
        </h2>
        <ul className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className="block font-medium">QR scans</span>
            Attendees scan your booth QR or staff scan their pass at the stand.
          </li>
          <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className="block font-medium">Floor plan taps</span>
            Selecting your booth on the interactive plan records a visit.
          </li>
          <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className="block font-medium">Profile & directory</span>
            Views from the exhibitor directory and search results count too.
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default ExhibitorVisitors;
