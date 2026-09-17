import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { APPOINTMENT_STATUSES } from '../../lib/constants';
import { formatDate, formatTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Modal, Select, Table, Tabs, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const AdminAppointments = () => {
  const toast = useToast();
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true' }), []);
  const stats = useApi(() => api.appointments.stats(), []);
  const [scope, setScope] = useState('all');
  const list = useListQuery((query) => api.appointments.list({ ...query, scope: scope === 'mine' ? 'mine' : undefined }), { limit: 12 }, [scope]);
  const [active, setActive] = useState(null);
  const [response, setResponse] = useState({ status: 'confirmed', note: '' });
  const [busy, setBusy] = useState(false);

  const respond = async () => {
    setBusy(true);
    try {
      await api.appointments.respond(active._id, response);
      toast.success(`Appointment ${response.status}`);
      setActive(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The appointment could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'reference',
      label: 'Meeting',
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate text-sm font-medium">{row.topic}</p>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.reference}</p>
        </div>
      ),
    },
    {
      key: 'when',
      label: 'When',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700 dark:text-slate-200">{formatDate(row.date)}</p>
          <p className="text-slate-500 dark:text-slate-400">
            {formatTime(row.startTime)}–{formatTime(row.endTime)} · {row.durationMinutes} min
          </p>
        </div>
      ),
    },
    {
      key: 'parties',
      label: 'Attendee ↔ Exhibitor',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium">{row.attendee?.name || '—'}</p>
          <p className="text-slate-500 dark:text-slate-400">{row.exhibitor?.companyName || row.exhibitorUser?.name || '—'}</p>
        </div>
      ),
    },
    { key: 'expo', label: 'Expo', render: (row) => <span className="text-xs">{row.expo?.title || '—'}</span> },
    { key: 'location', label: 'Location', render: (row) => <span className="text-xs">{row.location?.meetingPoint || row.location?.boothNumber || '—'}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {['pending', 'confirmed'].includes(row.status) ? (
            <Button
              size="xs"
              icon="check"
              onClick={() => {
                setActive(row);
                setResponse({ status: 'confirmed', note: '' });
              }}
            >
              Respond
            </Button>
          ) : (
            <Button size="xs" variant="secondary" icon="eye" onClick={() => setActive(row)}>
              View
            </Button>
          )}
        </div>
      ),
    },
  ];

  const counts = list.meta?.statusCounts || {};

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Monitor meetings booked between attendees and exhibitors, and step in when organizers are needed."
        icon="handshake"
        actions={
          <Select
            className="min-w-[220px]"
            value={list.filters.expo || ''}
            placeholder="All expos"
            options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
            onChange={(event) => list.setFilter('expo', event.target.value)}
            aria-label="Filter appointments by expo"
          />
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(APPOINTMENT_STATUSES.map((status) => ({ status, count: counts[status] || 0 }))).map((item) => (
          <Card key={item.status} className="card-pad">
            <p className="stat-label">{titleCase(item.status)}</p>
            <p className="stat-value mt-1">{item.count}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={scope}
          onChange={setScope}
          tabs={[
            { value: 'all', label: 'All appointments', icon: 'handshake' },
            { value: 'mine', label: 'My meetings', icon: 'user-cog' },
          ]}
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {stats.data?.total ?? 0} appointments · busiest exhibitor{' '}
          {stats.data?.busiestExhibitors?.[0]?.name ? `· ${stats.data.busiestExhibitors[0].name}` : '—'}
        </p>
      </div>

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by topic or reference…"
        onReset={list.reset}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: APPOINTMENT_STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
            onChange: (value) => list.setFilter('status', value),
          },
          {
            name: 'upcoming',
            label: 'Timing',
            value: list.filters.upcoming || '',
            placeholder: 'Any',
            options: [{ value: 'true', label: 'Upcoming only' }],
            onChange: (value) => list.setFilter('upcoming', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={6} />}>
        <Table columns={columns} rows={list.items} empty={<EmptyState icon="handshake" title="No appointments" message="Meetings booked by attendees appear here." />} />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.topic}
        subtitle={active ? `${formatDate(active.date)} · ${formatTime(active.startTime)}–${formatTime(active.endTime)}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActive(null)}>
              Close
            </Button>
            {active && ['pending', 'confirmed'].includes(active.status) && (
              <Button icon="check" loading={busy} onClick={respond} variant={response.status === 'rejected' ? 'danger' : 'primary'}>
                Save response
              </Button>
            )}
          </>
        }
      >
        {active && (
          <div className="space-y-4">
            <Card className="card-pad">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Attendee', value: active.attendee?.name },
                  { label: 'Exhibitor', value: active.exhibitor?.companyName || active.exhibitorUser?.name },
                  { label: 'Expo', value: active.expo?.title },
                  { label: 'Booth', value: active.location?.boothNumber || '—' },
                  { label: 'Meeting point', value: active.location?.meetingPoint || '—' },
                  { label: 'Status', value: titleCase(active.status) },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</dt>
                    <dd className="mt-0.5">{item.value || '—'}</dd>
                  </div>
                ))}
              </dl>
              {active.agenda && (
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                  <span className="font-medium">Agenda:</span> {active.agenda}
                </p>
              )}
            </Card>

            {['pending', 'confirmed'].includes(active.status) && (
              <div className="space-y-4">
                <Field label="Decision">
                  <Select
                    value={response.status}
                    options={[
                      { value: 'confirmed', label: 'Confirm appointment' },
                      { value: 'rejected', label: 'Reject appointment' },
                      { value: 'completed', label: 'Mark as completed' },
                    ]}
                    onChange={(event) => setResponse({ ...response, status: event.target.value })}
                  />
                </Field>
                <Field label="Note" hint="Included in the notification sent to both parties.">
                  <Textarea rows={3} value={response.note} onChange={(event) => setResponse({ ...response, note: event.target.value })} />
                </Field>
              </div>
            )}

            <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Icon name="bell" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Both the attendee and the exhibitor are notified of any status change.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminAppointments;
