import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime, initials, mediaUrl, titleCase } from '../../lib/utils';
import { Badge, Button, Card, Select, Table } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog, Drawer } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const STATUSES = ['pending', 'confirmed', 'attended', 'cancelled', 'waitlisted'];

const AdminAttendees = () => {
  const toast = useToast();
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true' }), []);
  const list = useListQuery((query) => api.registrations.list(query), { limit: 15 });
  const [detail, setDetail] = useState(null);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [busy, setBusy] = useState(false);

  const cancelRegistration = async () => {
    setBusy(true);
    try {
      await api.registrations.cancel(pendingCancel._id, { reason: 'Cancelled by organizer' });
      toast.success('Registration cancelled');
      setPendingCancel(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not cancel the registration');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'attendee',
      label: 'Attendee',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.user?.avatar ? (
            <img src={mediaUrl(row.user.avatar)} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {initials(row.user?.name || row.attendeeDetails?.fullName || '?')}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.user?.name || row.attendeeDetails?.fullName}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.user?.email || row.attendeeDetails?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'expo',
      label: 'Expo',
      render: (row) => (
        <div className="text-sm">
          <p>{row.expo?.title || '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{titleCase(row.passType)} pass</p>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    { key: 'paymentStatus', label: 'Payment', render: (row) => <Badge status={row.paymentStatus} /> },
    {
      key: 'checkedIn',
      label: 'Check-in',
      render: (row) =>
        row.checkedIn ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Checked in {formatDateTime(row.checkedInAt)}</span>
        ) : (
          <span className="text-xs text-slate-400">Not yet</span>
        ),
    },
    { key: 'passCode', label: 'Pass', render: (row) => <span className="font-mono text-xs">{row.passCode}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="xs" variant="secondary" icon="eye" onClick={() => setDetail(row)}>
            Details
          </Button>
          {row.status !== 'cancelled' && (
            <Button size="xs" variant="ghost" onClick={() => setPendingCancel(row)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Attendees & registrations"
        subtitle="Every registration across your expos with payment, pass and check-in status."
        icon="users"
        actions={
          <Select
            className="min-w-[220px]"
            value={list.filters.expo || ''}
            placeholder="All expos"
            options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
            onChange={(event) => list.setFilter('expo', event.target.value)}
            aria-label="Filter by expo"
          />
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by attendee name, email or pass code…"
        onReset={list.reset}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
            onChange: (value) => list.setFilter('status', value),
          },
          {
            name: 'checkedIn',
            label: 'Check-in',
            value: list.filters.checkedIn || '',
            placeholder: 'Any',
            options: [
              { value: 'true', label: 'Checked in' },
              { value: 'false', label: 'Not checked in' },
            ],
            onChange: (value) => list.setFilter('checkedIn', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={5} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={<EmptyState icon="users" title="No registrations yet" message="Attendee registrations appear here as soon as your expos open." />}
        />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} title="Registration details">
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {detail.user?.avatar ? (
                <img src={mediaUrl(detail.user.avatar)} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {initials(detail.user?.name || '?')}
                </span>
              )}
              <div>
                <p className="text-base font-semibold">{detail.user?.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{detail.user?.email}</p>
                {detail.user?.organization && <p className="text-xs text-slate-500 dark:text-slate-400">{detail.user.organization}</p>}
              </div>
            </div>

            <Card className="card-pad">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Expo', value: detail.expo?.title },
                  { label: 'Status', value: titleCase(detail.status) },
                  { label: 'Pass code', value: detail.passCode },
                  { label: 'Pass type', value: titleCase(detail.passType) },
                  { label: 'Payment', value: titleCase(detail.paymentStatus) },
                  { label: 'Amount', value: formatCurrency(detail.amount, detail.currency) },
                  { label: 'Registered', value: formatDateTime(detail.createdAt) },
                  { label: 'Checked in', value: detail.checkedIn ? formatDateTime(detail.checkedInAt) : 'Not yet' },
                  { label: 'Phone', value: detail.attendeeDetails?.phone || '—' },
                  { label: 'Organisation', value: detail.attendeeDetails?.organization || '—' },
                  { label: 'Job title', value: detail.attendeeDetails?.jobTitle || '—' },
                  { label: 'Country', value: detail.attendeeDetails?.country || '—' },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</dt>
                    <dd className="mt-0.5">{item.value || '—'}</dd>
                  </div>
                ))}
              </dl>
              {(detail.attendeeDetails?.dietaryRequirements || detail.attendeeDetails?.accessibilityNeeds) && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                  {detail.attendeeDetails.dietaryRequirements && <p>Dietary: {detail.attendeeDetails.dietaryRequirements}</p>}
                  {detail.attendeeDetails.accessibilityNeeds && <p>Accessibility: {detail.attendeeDetails.accessibilityNeeds}</p>}
                </div>
              )}
            </Card>

            {detail.cancelReason && <p className="text-sm text-rose-600 dark:text-rose-400">Cancellation reason: {detail.cancelReason}</p>}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        onConfirm={cancelRegistration}
        loading={busy}
        title="Cancel this registration?"
        confirmLabel="Cancel registration"
        message="The attendee will be notified and their pass will stop working at check-in."
      />
    </div>
  );
};

export default AdminAttendees;
