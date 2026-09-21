import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, StatCard } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/overlay';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const AttendeeExpos = () => {
  const toast = useToast();
  const list = useListQuery((query) => api.registrations.mine(query), { limit: 9 });
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const registrations = list.items;
  const upcoming = registrations.filter(
    (item) => item.expo && new Date(item.expo.startDate) >= new Date(new Date().toDateString()) && item.status !== 'cancelled',
  );
  const attended = registrations.filter((item) => item.checkedIn || item.status === 'attended');
  const spend = registrations
    .filter((item) => item.paymentStatus === 'paid')
    .reduce((sum, item) => sum + (item.amount || 0), 0);

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api.registrations.cancel(cancelling._id, { reason: 'Cancelled by attendee from the dashboard' });
      toast.success('Registration cancelled');
      setCancelling(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The registration could not be cancelled');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="My expos"
        subtitle="Every expo you registered for, with your pass status, check-ins and what you paid."
        icon="calendar"
        actions={
          <Link to="/expos">
            <Button icon="compass">Find another expo</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registrations" value={list.meta?.total ?? registrations.length} hint="Across all expos" icon="ticket" />
        <StatCard label="Upcoming" value={upcoming.length} hint="On this page" icon="calendar" tone="info" />
        <StatCard label="Checked in" value={attended.length} hint="Passes already scanned" icon="qr" tone="success" />
        <StatCard label="Spent (page)" value={formatCurrency(spend)} hint="Paid registrations" icon="credit-card" tone="warning" />
      </div>

      <div className="mt-5">
        <FilterBar
          search={list.search}
          onSearch={list.setSearch}
          searchPlaceholder="Search by expo name, city or venue…"
          onReset={list.reset}
          filters={[
            {
              name: 'status',
              label: 'Status',
              value: list.filters.status || '',
              options: [
                { value: 'pending', label: 'Pending' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'attended', label: 'Attended' },
                { value: 'cancelled', label: 'Cancelled' },
              ],
              onChange: (value) => list.setFilter('status', value),
            },
            {
              name: 'upcoming',
              label: 'When',
              value: list.filters.upcoming || '',
              options: [{ value: 'true', label: 'Upcoming only' }],
              onChange: (value) => list.setFilter('upcoming', value),
            },
          ]}
        />

        {list.loading ? (
          <LoadingState rows={3} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : registrations.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="You have not registered for an expo yet"
            message="Browse the catalogue, pick an expo and register to get your QR event pass instantly."
            action={
              <Link to="/expos">
                <Button icon="compass">Browse expos</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {registrations.map((registration) => {
                const expo = registration.expo;
                const startDate = expo?.startDate;
                const isUpcoming = startDate && new Date(startDate) >= new Date(new Date().toDateString());
                return (
                  <Card key={registration._id} hover className="flex flex-col overflow-hidden">
                    {expo?.banner ? (
                      <img src={mediaUrl(expo.banner)} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-300">
                        <Icon name="calendar" className="h-9 w-9" />
                      </div>
                    )}

                    <div className="card-pad flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-base font-semibold">{expo?.title || 'Expo removed'}</h2>
                        <Badge status={registration.status} dot />
                      </div>

                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Icon name="location" className="h-3.5 w-3.5" />
                        {expo?.location?.venue || 'Venue TBA'}
                        {expo?.location?.city ? `, ${expo.location.city}` : ''}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Icon name="clock" className="h-3.5 w-3.5" />
                        {formatDate(expo?.startDate)} – {formatDate(expo?.endDate)}
                        {isUpcoming ? ' · upcoming' : ''}
                      </p>

                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <dt className="text-slate-500 dark:text-slate-400">Pass code</dt>
                          <dd className="truncate font-mono">{registration.passCode || '—'}</dd>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <dt className="text-slate-500 dark:text-slate-400">Pass type</dt>
                          <dd>{titleCase(registration.passType || 'standard')}</dd>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <dt className="text-slate-500 dark:text-slate-400">Check-in</dt>
                          <dd className="flex items-center gap-1">
                            <Icon name={registration.checkedIn ? 'check' : 'clock'} className="h-3.5 w-3.5" />
                            {registration.checkedIn ? 'Scanned at the door' : 'Not scanned yet'}
                          </dd>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                          <dt className="text-slate-500 dark:text-slate-400">Payment</dt>
                          <dd>{titleCase(registration.paymentStatus || 'not_required')}</dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link to="/attendee/pass">
                          <Button size="sm" icon="qr">
                            Event pass
                          </Button>
                        </Link>
                        <Link to={`/expos/${expo?.slug || expo?._id}`}>
                          <Button size="sm" variant="secondary" icon="eye">
                            Expo page
                          </Button>
                        </Link>
                        {registration.status !== 'cancelled' && (
                          <Button size="sm" variant="ghost" icon="x" onClick={() => setCancelling(registration)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Pagination meta={list.meta} onPageChange={list.setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        loading={busy}
        title="Cancel this registration?"
        confirmLabel="Cancel registration"
        message={
          cancelling
            ? `Your pass for ${cancelling.expo?.title || 'this expo'} will be revoked, session bookings stay in your agenda and any paid amount is refunded by the organisers.`
            : ''
        }
      />
    </div>
  );
};

export default AttendeeExpos;
