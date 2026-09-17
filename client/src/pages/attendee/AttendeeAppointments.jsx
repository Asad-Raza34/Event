import { useMemo, useState } from 'react';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatDate, formatTime, titleCase, relativeTime } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Tabs } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/overlay';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const STATUS_TABS = [
  { value: 'all', label: 'All', icon: 'grid' },
  { value: 'pending', label: 'Pending', icon: 'clock' },
  { value: 'confirmed', label: 'Confirmed', icon: 'check' },
  { value: 'completed', label: 'Completed', icon: 'check' },
  { value: 'cancelled', label: 'Cancelled', icon: 'x' },
];

const AttendeeAppointments = () => {
  const toast = useToast();
  const [statusTab, setStatusTab] = useState('all');
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = useListQuery(
    (query) => api.appointments.list({ ...query, status: statusTab === 'all' ? undefined : statusTab }),
    { limit: 10 },
  );

  const appointments = list.items;

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api.appointments.cancel(cancelling._id, { reason: 'Cancelled by attendee' });
      toast.success('Appointment cancelled');
      setCancelling(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The appointment could not be cancelled');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="My appointments"
        subtitle="Meetings you requested with exhibitors. Track status, respond to changes and manage your calendar."
        icon="handshake"
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={() => list.reload()}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs active={statusTab} onChange={setStatusTab} tabs={STATUS_TABS} />
      </div>

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by topic, exhibitor or expo…"
        onReset={list.reset}
        filters={[
          {
            name: 'dateFrom',
            label: 'From date',
            type: 'date',
            value: list.filters.dateFrom || '',
            onChange: (value) => list.setFilter('dateFrom', value),
          },
          {
            name: 'dateTo',
            label: 'To date',
            type: 'date',
            value: list.filters.dateTo || '',
            onChange: (value) => list.setFilter('dateTo', value),
          },
        ]}
      />

      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon="handshake"
          title={statusTab === 'all' ? 'No appointments yet' : `No ${statusTab} appointments`}
          message="Request meetings with exhibitors from their profiles or the exhibitor directory."
          action={
            <a href="/exhibitors">
              <Button icon="compass">Browse exhibitors</Button>
            </a>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <Card key={appointment._id} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  {appointment.exhibitor?.logo ? (
                    <img src={appointment.exhibitor.logo} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                      <Icon name="building" className="h-7 w-7" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">{appointment.topic}</h3>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{appointment.exhibitor?.companyName || 'Exhibitor'}</p>
                      </div>
                      <Badge status={appointment.status} />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Icon name="calendar" className="h-3.5 w-3.5" />
                        {formatDate(appointment.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="clock" className="h-3.5 w-3.5" />
                        {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
                      </span>
                      {appointment.location && (
                        <span className="flex items-center gap-1.5">
                          <Icon name="location" className="h-3.5 w-3.5" />
                          {appointment.location}
                        </span>
                      )}
                      {appointment.expo?.title && (
                        <span className="flex items-center gap-1.5">
                          <Icon name="ticket" className="h-3.5 w-3.5" />
                          {appointment.expo.title}
                        </span>
                      )}
                    </div>

                    {appointment.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{appointment.notes}</p>}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {['pending', 'confirmed'].includes(appointment.status) && (
                      <>
                        <Button size="sm" variant="ghost" icon="x" onClick={() => setCancelling(appointment)}>
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="secondary" icon="eye" onClick={() => {}}>
                      Details
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Pagination meta={list.meta} onPageChange={list.setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        loading={busy}
        title="Cancel this appointment?"
        confirmLabel="Cancel appointment"
        message={
          cancelling
            ? `Your meeting "${cancelling.topic}" with ${cancelling.exhibitor?.companyName || 'the exhibitor'} will be cancelled. The exhibitor will be notified.`
            : ''
        }
      />
    </div>
  );
};

export default AttendeeAppointments;