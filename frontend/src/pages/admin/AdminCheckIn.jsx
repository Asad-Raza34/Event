import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { formatDateTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Card, CardHeader, Select, StatCard, Table, Tabs } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';
import CheckInScanner from '../../features/checkin/CheckInScanner';

const AdminCheckIn = () => {
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true' }), []);
  const [expoId, setExpoId] = useState('');
  const [tab, setTab] = useState('scan');
  const history = useListQuery((query) => api.checkIns.list({ ...query, expo: expoId || undefined }), { limit: 15 }, [expoId, tab]);

  const columns = [
    {
      key: 'user',
      label: 'Attendee',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.user?.name || row.scannerName || '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.user?.email}</p>
        </div>
      ),
    },
    { key: 'type', label: 'Type', render: (row) => <Badge tone="info">{titleCase(row.type)}</Badge> },
    {
      key: 'context',
      label: 'Context',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.type === 'booth'
            ? `Booth ${row.booth?.zone}-${row.booth?.number}`
            : row.type === 'session'
              ? row.session?.title
              : row.expo?.title}
        </span>
      ),
    },
    { key: 'method', label: 'Method', render: (row) => titleCase(row.method) },
    { key: 'checkedInAt', label: 'When', render: (row) => <span className="text-xs">{formatDateTime(row.checkedInAt)}</span> },
    { key: 'scannerName', label: 'Scanned by', render: (row) => <span className="text-xs">{row.scannerName || 'Self service'}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Check-in desk"
        subtitle="Scan event passes, booth codes and session passes — or type a code manually as a fallback."
        icon="qr"
        actions={
          <Select
            className="min-w-[230px]"
            value={expoId}
            placeholder="All expos"
            options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
            onChange={(event) => setExpoId(event.target.value)}
            aria-label="Filter check-ins by expo"
          />
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Check-ins recorded" value={history.meta?.total ?? 0} icon="check" tone="success" />
        <StatCard label="Scanned in this session" value={tab === 'scan' ? 'Live' : '—'} icon="qr" tone="brand" hint="Scans appear instantly below" />
        <StatCard label="Expos with check-in" value={expos.data?.length ?? 0} icon="calendar" tone="info" />
      </div>

      <div className="mb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'scan', label: 'Scanner', icon: 'qr' },
            { value: 'log', label: 'Check-in log', icon: 'clipboard', count: history.meta?.total },
          ]}
        />
      </div>

      {tab === 'scan' ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <CheckInScanner expoId={expoId || undefined} onCheckedIn={() => history.reload()} />
          <Card className="card-pad">
            <h2 className="text-sm font-semibold">How check-in works</h2>
            <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <Icon name="qr" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Attendees show the QR pass from their dashboard; scanning marks the registration as attended.
              </li>
              <li className="flex items-start gap-2">
                <Icon name="map" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Booth codes record booth traffic for exhibitor analytics.
              </li>
              <li className="flex items-start gap-2">
                <Icon name="mic" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Session codes mark attendance and update session statistics.
              </li>
              <li className="flex items-start gap-2">
                <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                Cancelled or unpaid passes are rejected with a clear reason.
              </li>
            </ul>
          </Card>
        </div>
      ) : (
        <>
          <FilterBar
            search={history.search}
            onSearch={history.setSearch}
            searchPlaceholder="Search by attendee name…"
            onReset={history.reset}
            filters={[
              {
                name: 'type',
                label: 'Type',
                value: history.filters.type || '',
                options: [
                  { value: 'event', label: 'Event pass' },
                  { value: 'booth', label: 'Booth' },
                  { value: 'session', label: 'Session' },
                ],
                onChange: (value) => history.setFilter('type', value),
              },
            ]}
          />
          <DataState loading={history.loading} error={history.error} onRetry={history.reload} skeleton={<TableSkeleton rows={8} columns={5} />}>
            <Table
              columns={columns}
              rows={history.items}
              empty={<EmptyState icon="qr" title="No check-ins yet" message="Scanned passes will be listed here in real time." />}
            />
            <Pagination meta={history.meta} onPageChange={history.setPage} />
          </DataState>
        </>
      )}
    </div>
  );
};

export default AdminCheckIn;
