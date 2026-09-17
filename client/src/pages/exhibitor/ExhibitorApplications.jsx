import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { BOOTH_SIZES, BOOTH_ZONES } from '../../lib/constants';
import { formatDate, formatDateTime, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Input, Modal, Select, Table, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'withdrawn'];

const ExhibitorApplications = () => {
  const toast = useToast();
  const list = useListQuery((query) => api.exhibitors.myApplications(query), { limit: 10 });
  const expos = useApi(() => api.expos.list({ limit: 100, registrationOpen: 'true', sort: 'startDate' }), []);
  const products = useApi(() => api.exhibitors.products({ limit: 100 }), []);
  const [applyOpen, setApplyOpen] = useState(false);
  const [pendingWithdraw, setPendingWithdraw] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useForm({
    expoId: '',
    size: 'medium',
    zone: '',
    notes: '',
    productsToShowcase: [],
    specialRequests: '',
  });

  const apply = async () => {
    const result = await form.submit((values) =>
      api.exhibitors.apply({
        expoId: values.expoId,
        boothPreferences: { size: values.size, zone: values.zone, notes: values.notes },
        productsToShowcase: values.productsToShowcase,
        specialRequests: values.specialRequests,
      }),
    );
    if (result.ok) {
      toast.success('Application submitted — the organizers will review it shortly');
      setApplyOpen(false);
      form.reset({ expoId: '', size: 'medium', zone: '', notes: '', productsToShowcase: [], specialRequests: '' });
      list.reload();
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await api.exhibitors.withdraw(pendingWithdraw._id);
      toast.success('Application withdrawn');
      setPendingWithdraw(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The application could not be withdrawn');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'expo',
      label: 'Expo',
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate text-sm font-medium">{row.expo?.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatDate(row.expo?.startDate)} – {formatDate(row.expo?.endDate)} · {row.expo?.location?.city || 'Venue TBA'}
          </p>
        </div>
      ),
    },
    {
      key: 'preferences',
      label: 'Preferences',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {titleCase(row.boothPreferences?.size || 'medium')} · zone {row.boothPreferences?.zone || 'any'}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    { key: 'booth', label: 'Booth', render: (row) => <span className="text-xs">{row.assignedBooth ? `${row.assignedBooth.zone}-${row.assignedBooth.number}` : '—'}</span> },
    { key: 'submitted', label: 'Submitted', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
    { key: 'reviewNote', label: 'Organizer note', render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400">{row.reviewNote ? truncate(row.reviewNote, 60) : '—'}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.assignedBooth && (
            <Link to="/exhibitor/booth">
              <Button size="xs" variant="secondary" icon="map">
                My booth
              </Button>
            </Link>
          )}
          {['pending', 'under_review'].includes(row.status) && (
            <Button size="xs" variant="ghost" onClick={() => setPendingWithdraw(row)}>
              Withdraw
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Expo applications"
        subtitle="Apply to expos, track review progress and see assigned booths."
        icon="clipboard"
        actions={
          <Button icon="plus" onClick={() => setApplyOpen(true)} disabled={!expos.data?.length}>
            Apply to an expo
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search your applications…"
        onReset={list.reset}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
            onChange: (value) => list.setFilter('status', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={6} columns={5} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={
            <EmptyState
              icon="clipboard"
              title="No applications yet"
              message="Apply to an open expo to request a booth and get reviewed by the organizers."
              action={
                <Button icon="plus" onClick={() => setApplyOpen(true)} disabled={!expos.data?.length}>
                  Apply to an expo
                </Button>
              }
            />
          }
        />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        size="lg"
        title="Apply to an expo"
        subtitle="Tell the organizers what you need — you can refine booth preferences after approval."
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button icon="send" loading={form.submitting} onClick={apply} disabled={!form.values.expoId}>
              Submit application
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Expo" required error={form.errors.expoId}>
            <Select
              name="expoId"
              value={form.values.expoId}
              placeholder="Choose an expo"
              options={(expos.data || []).map((expo) => ({ value: expo._id, label: `${expo.title} · ${formatDate(expo.startDate)}` }))}
              onChange={form.handleChange}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred booth size">
              <Select name="size" value={form.values.size} onChange={form.handleChange} options={BOOTH_SIZES.map((size) => ({ value: size, label: titleCase(size) }))} />
            </Field>
            <Field label="Preferred zone">
              <Select
                name="zone"
                value={form.values.zone}
                placeholder="Any zone"
                options={BOOTH_ZONES.map((zone) => ({ value: zone, label: `Zone ${zone}` }))}
                onChange={form.handleChange}
              />
            </Field>
          </div>

          <Field label="Products to showcase" hint="Hold ⌘/Ctrl to select multiple">
            <select multiple name="productsToShowcase" value={form.values.productsToShowcase} onChange={form.handleChange} className="input h-32">
              {(products.data || []).map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Booth notes">
            <Textarea name="notes" rows={2} value={form.values.notes} onChange={form.handleChange} placeholder="We need extra power sockets and a small storage area." />
          </Field>
          <Field label="Special requests">
            <Textarea name="specialRequests" rows={2} value={form.values.specialRequests} onChange={form.handleChange} placeholder="Any additional requirements for the organizers." />
          </Field>

          <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Once approved you can reserve a specific booth on the interactive floor plan and pay the booth fee.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingWithdraw)}
        onClose={() => setPendingWithdraw(null)}
        onConfirm={withdraw}
        loading={busy}
        title="Withdraw this application?"
        confirmLabel="Withdraw"
        message={`Your application for "${pendingWithdraw?.expo?.title}" will be withdrawn. You can apply again while registration is open.`}
      />
    </div>
  );
};

export default ExhibitorApplications;
