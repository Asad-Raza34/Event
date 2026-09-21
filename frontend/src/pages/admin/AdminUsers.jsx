import { useState } from 'react';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { ROLES } from '../../lib/constants';
import { formatDate, formatDateTime, initials, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Select, Table } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog, Drawer } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const AdminUsers = () => {
  const toast = useToast();
  const list = useListQuery((query) => api.users.list(query), { limit: 15 });
  const stats = useApi(() => api.users.stats(), []);
  const [detailId, setDetailId] = useState(null);
  const detail = useApi(() => api.users.detail(detailId), [detailId], { enabled: Boolean(detailId) });
  const [pendingToggle, setPendingToggle] = useState(null);
  const [busy, setBusy] = useState(false);

  const changeRole = async (user, role) => {
    try {
      await api.users.update(user._id, { role });
      toast.success(`${user.name} is now a ${role}`);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Role could not be changed');
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      await api.users.setActive(pendingToggle._id, !pendingToggle.isActive);
      toast.success(pendingToggle.isActive ? 'Account deactivated' : 'Account reactivated');
      setPendingToggle(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The account could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const totals = stats.data || {};

  const columns = [
    {
      key: 'name',
      label: 'User',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.avatar ? (
            <img src={mediaUrl(row.avatar)} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {initials(row.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (row) => <Badge tone={row.role === 'admin' ? 'brand' : row.role === 'exhibitor' ? 'info' : 'neutral'}>{titleCase(row.role)}</Badge> },
    { key: 'organization', label: 'Organisation', render: (row) => <span className="text-sm">{row.organization || '—'}</span> },
    { key: 'createdAt', label: 'Joined', render: (row) => <span className="text-xs">{formatDate(row.createdAt)}</span> },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <Badge tone={row.isActive ? 'success' : 'danger'}>{row.isActive ? 'Active' : 'Disabled'}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="xs" variant="secondary" icon="eye" onClick={() => setDetailId(row._id)}>
            Details
          </Button>
          <select
            value={row.role}
            onChange={(event) => changeRole(row, event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            aria-label={`Change role for ${row.name}`}
          >
            <option value={ROLES.ATTENDEE}>Attendee</option>
            <option value={ROLES.EXHIBITOR}>Exhibitor</option>
            <option value={ROLES.ADMIN}>Organizer</option>
          </select>
          <Button size="xs" variant="ghost" onClick={() => setPendingToggle(row)}>
            {row.isActive ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Every account on the platform — change roles, disable access and inspect activity."
        icon="user-cog"
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total users', value: totals.total ?? '—', icon: 'users' },
          { label: 'Attendees', value: totals.attendee ?? '—', icon: 'ticket' },
          { label: 'Exhibitors', value: totals.exhibitor ?? '—', icon: 'building' },
          { label: 'Organizers', value: totals.admin ?? '—', icon: 'settings' },
        ].map((item) => (
          <Card key={item.label} className="card-pad flex items-center gap-3">
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="text-xl font-bold">{item.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by name, email, organisation or city…"
        onReset={list.reset}
        filters={[
          {
            name: 'role',
            label: 'Role',
            value: list.filters.role || '',
            options: [
              { value: ROLES.ADMIN, label: 'Organizer' },
              { value: ROLES.EXHIBITOR, label: 'Exhibitor' },
              { value: ROLES.ATTENDEE, label: 'Attendee' },
            ],
            onChange: (value) => list.setFilter('role', value),
          },
          {
            name: 'active',
            label: 'Status',
            value: list.filters.active || '',
            placeholder: 'Any',
            options: [
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Disabled' },
            ],
            onChange: (value) => list.setFilter('active', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={5} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={<EmptyState icon="users" title="No users match" message="Try a different search term or filter." />}
        />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Drawer open={Boolean(detailId)} onClose={() => setDetailId(null)} title="User details">
        {detail.loading ? (
          <div className="space-y-3">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-4 w-56" />
            <div className="skeleton h-24 w-full" />
          </div>
        ) : detail.data ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {initials(detail.data.user.name)}
              </span>
              <div>
                <p className="text-base font-semibold">{detail.data.user.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{detail.data.user.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone="brand">{titleCase(detail.data.user.role)}</Badge>
                  <Badge tone={detail.data.user.isActive ? 'success' : 'danger'}>{detail.data.user.isActive ? 'Active' : 'Disabled'}</Badge>
                </div>
              </div>
            </div>

            <Card className="card-pad">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Phone', value: detail.data.user.phone || '—' },
                  { label: 'Organisation', value: detail.data.user.organization || '—' },
                  { label: 'City', value: detail.data.user.city || '—' },
                  { label: 'Country', value: detail.data.user.country || '—' },
                  { label: 'Registered', value: formatDate(detail.data.user.createdAt) },
                  { label: 'Last seen', value: detail.data.user.lastSeenAt ? formatDateTime(detail.data.user.lastSeenAt) : '—' },
                  { label: 'Registrations', value: detail.data.registrationCount },
                  { label: 'Email verified', value: detail.data.user.isEmailVerified ? 'Yes' : 'No' },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</dt>
                    <dd className="mt-0.5">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            {detail.data.exhibitorProfile && (
              <Card className="card-pad">
                <p className="text-sm font-semibold">Exhibitor profile</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {detail.data.exhibitorProfile.companyName} · {detail.data.exhibitorProfile.products?.length || 0} products
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ★ {Number(detail.data.exhibitorProfile.avgRating || 0).toFixed(1)} · {detail.data.exhibitorProfile.profileViews || 0} profile views
                </p>
              </Card>
            )}

            <Button
              variant={detail.data.user.isActive ? 'danger' : 'primary'}
              className="w-full"
              icon={detail.data.user.isActive ? 'lock' : 'check'}
              onClick={() => setPendingToggle(detail.data.user)}
            >
              {detail.data.user.isActive ? 'Disable this account' : 'Reactivate this account'}
            </Button>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        onClose={() => setPendingToggle(null)}
        onConfirm={toggleActive}
        loading={busy}
        title={pendingToggle?.isActive ? 'Disable this account?' : 'Reactivate this account?'}
        confirmLabel={pendingToggle?.isActive ? 'Disable account' : 'Reactivate'}
        tone={pendingToggle?.isActive ? 'danger' : 'primary'}
        message={
          pendingToggle?.isActive
            ? `${pendingToggle?.name} will be signed out and blocked from signing in until reactivated.`
            : `${pendingToggle?.name} will be able to sign in again immediately.`
        }
      />
    </div>
  );
};

export default AdminUsers;
