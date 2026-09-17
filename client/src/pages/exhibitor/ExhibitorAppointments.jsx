import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { APPOINTMENT_STATUSES } from '../../lib/constants';
import { formatDate, formatTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Field, Modal, Select, StatCard, Table, Tabs, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const ExhibitorAppointments = () => {
  const toast = useToast();
  const stats = useApi(() => api.appointments.stats(), []);
  const list = useListQuery((query) => api.appointments.list({ ...query, scope: 'exhibitor' }), { limit: 12 });
  const [view, setView] = useState('list');
  const [active, setActive] = useState(null);
  const [response, setResponse] = useState({ status: 'confirmed', note: '', meetingLink: '' });
  const [busy, setBusy] = useState(false);

  const calendar = useApi(() => api.appointments.calendar({ scope: 'mine' }), [view], { enabled: view === 'calendar' });

  const submit = async () => {
    setBusy(true);
    try {
      if (response.status === 'completed') await api.appointments.complete(active._id, { meetingNotes: response.note });
      else await api.appointments.respond(active._id, response);
      toast.success('Appointment updated — the attendee was notified');
      setActive(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The appointment could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (appointment) => {
    try {
      await api.appointments.cancel(appointment._id, { reason: 'Cancelled by exhibitor' });
      toast.success('Appointment cancelled');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not cancel the appointment');
    }
  };

  const columns = [
    {
      key: 'topic',
      label: 'Meeting',
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate text-sm font-medium">{row.topic}</p>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.reference}</p>
        </div>
      ),
    },
    {
      key: 'attendee',
      label: 'Attendee',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700 dark:text-slate-200">{row.attendee?.name}</p>
          <p className="text-slate-500 dark:text-slate-400">{row.attendee?.organization || row.attendee?.email}</p>
        </div>
      ),
    },
    {
      key: 'when',
      label: 'When',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium">{formatDate(row.date)}</p>
          <p className="text-slate-500 dark:text-slate-400">
            {formatTime(row.startTime)}–{formatTime(row.endTime)}
          </p>
        </div>
      ),
    },
    { key: 'expo', label: 'Expo', render: (row) => <span className="text-xs">{row.expo?.title}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {row.status === 'pending' && (
            <Button
              size="xs"
              icon="check"
              onClick={() => {
                setActive(row);
                setResponse({ status: 'confirmed', note: '', meetingLink: '' });
              }}
            >
              Respond
            </Button>
          )}
          {row.status === 'confirmed' && (
            <>
              <Button
                size="xs"
                variant="secondary"
                icon="check"
                onClick={() => {
                  setActive(row);
                  setResponse({ status: 'completed', note: '', meetingLink: '' });
                }}
              >
                Complete
              </Button>
              <Button size="xs" variant="ghost" onClick={() => cancel(row)}>
                Cancel
              </Button>
            </>
          )}
          {['rejected', 'cancelled', 'completed'].includes(row.status) && (
            <Button size="xs" variant="ghost" icon="eye" onClick={() => setActive(row)}>
              Details
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
        subtitle="Requests from attendees — confirm, reschedule or complete meetings at your booth."
        icon="handshake"
        actions={
          <Select
            className="w-[160px]"
            value={list.filters.upcoming ? 'true' : ''}
            placeholder="All meetings"
            options={[{ value: 'true', label: 'Upcoming only' }]}
            onChange={(event) => list.setFilter('upcoming', event.target.value)}
            aria-label="Filter by timing"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total meetings" value={stats.data?.total ?? 0} icon="handshake" />
        <StatCard label="Pending requests" value={counts.pending ?? stats.data?.pending ?? 0} icon="clock" tone="warning" />
        <StatCard label="Confirmed" value={counts.confirmed ?? stats.data?.confirmed ?? 0} icon="check" tone="success" />
        <StatCard label="Completed" value={counts.completed ?? stats.data?.completed ?? 0} icon="star" tone="info" />
      </div>

      <div className="mt-5 mb-4">
        <Tabs
          active={view}
          onChange={setView}
          tabs={[
            { value: 'list', label: 'List', icon: 'clipboard' },
            { value: 'calendar', label: 'Calendar', icon: 'calendar' },
          ]}
        />
      </div>

      {view === 'calendar' ? (
        <Card>
          <CardHeader title="Meeting calendar" subtitle="Your confirmed and pending meetings" icon="calendar" />
          <div className="card-pad">
            {calendar.loading ? (
              <TableSkeleton rows={3} columns={3} />
            ) : (calendar.data || []).length === 0 ? (
              <EmptyState icon="calendar" title="Nothing on the calendar" message="Booked meetings appear here once attendees request them." className="border-0" />
            ) : (
              <div className="space-y-4">
                {(calendar.data || []).map((entry, index) => (
                  <div key={entry.date || index}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{formatDate(entry.date)}</p>
                    <ul className="mt-2 space-y-2">
                      {(entry.appointments || entry.items || []).map((appointment) => (
                        <li key={appointment._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <span className="w-[110px] text-sm font-medium">
                            {formatTime(appointment.startTime)}–{formatTime(appointment.endTime)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{appointment.topic}</span>
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{appointment.attendee?.name}</span>
                          </span>
                          <Badge status={appointment.status} dot />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : (
        <>
          <FilterBar
            search={list.search}
            onSearch={list.setSearch}
            searchPlaceholder="Search meetings by topic or reference…"
            onReset={list.reset}
            filters={[
              {
                name: 'status',
                label: 'Status',
                value: list.filters.status || '',
                options: APPOINTMENT_STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
                onChange: (value) => list.setFilter('status', value),
              },
            ]}
          />
          <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={5} />}>
            <Table columns={columns} rows={list.items} empty={<EmptyState icon="handshake" title="No appointment requests" message="Attendees can book meetings from your public profile and the floor plan." />} />
            <Pagination meta={list.meta} onPageChange={list.setPage} />
          </DataState>
        </>
      )}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.topic}
        subtitle={active ? `${formatDate(active.date)} · ${formatTime(active.startTime)}–${formatTime(active.endTime)} · ${active.attendee?.name}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActive(null)}>
              Close
            </Button>
            {active && ['pending', 'confirmed'].includes(active.status) && (
              <Button icon="check" loading={busy} variant={response.status === 'rejected' ? 'danger' : 'primary'} onClick={submit}>
                Save
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
                  { label: 'Email', value: active.attendee?.email },
                  { label: 'Organisation', value: active.attendee?.organization || '—' },
                  { label: 'Expo', value: active.expo?.title },
                  { label: 'Meeting point', value: active.location?.meetingPoint || active.location?.boothNumber || '—' },
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
                      { value: 'confirmed', label: 'Confirm meeting' },
                      { value: 'rejected', label: 'Decline meeting' },
                      { value: 'completed', label: 'Mark as completed' },
                    ]}
                    onChange={(event) => setResponse({ ...response, status: event.target.value })}
                  />
                </Field>
                <Field label="Meeting link" hint="Optional — for hybrid or online meetings">
                  <input
                    className="input"
                    value={response.meetingLink}
                    onChange={(event) => setResponse({ ...response, meetingLink: event.target.value })}
                    placeholder="https://meet.example.com/booth-12"
                  />
                </Field>
                <Field label="Note for the attendee">
                  <Textarea rows={3} value={response.note} onChange={(event) => setResponse({ ...response, note: event.target.value })} />
                </Field>
              </div>
            )}

            <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Icon name="bell" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Attendees are notified automatically about every status change.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExhibitorAppointments;
