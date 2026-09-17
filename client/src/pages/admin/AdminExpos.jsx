import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { EXPO_CATEGORIES, EXPO_STATUSES } from '../../lib/constants';
import { formatCurrency, formatDate, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Field, Input, Modal, Select, Table, Textarea } from '../../components/ui';
import { DataState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog, Dropdown, DropdownItem } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const emptyExpo = {
  title: '',
  summary: '',
  description: '',
  theme: '',
  category: 'technology',
  startDate: '',
  endDate: '',
  registrationDeadline: '',
  location: { venue: '', city: '', address: '' },
  maxAttendees: 500,
  ticketPrice: 0,
  boothPriceFrom: 0,
  status: 'draft',
  tags: '',
};

const AdminExpos = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const list = useListQuery((query) => api.expos.list({ ...query, includeDrafts: 'true' }), { limit: 12 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useForm(emptyExpo);

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyExpo);
    setModalOpen(true);
  };

  const openEdit = (expo) => {
    setEditing(expo);
    form.reset({
      title: expo.title,
      summary: expo.summary || '',
      description: expo.description || '',
      theme: expo.theme || '',
      category: expo.category || 'technology',
      startDate: expo.startDate?.slice(0, 10) || '',
      endDate: expo.endDate?.slice(0, 10) || '',
      registrationDeadline: expo.registrationDeadline?.slice(0, 10) || '',
      location: {
        venue: expo.location?.venue || '',
        city: expo.location?.city || '',
        address: expo.location?.address || '',
      },
      maxAttendees: expo.maxAttendees || 0,
      ticketPrice: expo.ticketPrice || 0,
      boothPriceFrom: expo.boothPriceFrom || 0,
      status: expo.status || 'draft',
      tags: (expo.tags || []).join(', '),
    });
    setModalOpen(true);
  };

  const save = (values) =>
    form.submit(async (payload) => {
      const body = {
        ...payload,
        maxAttendees: Number(payload.maxAttendees) || 0,
        ticketPrice: Number(payload.ticketPrice) || 0,
        boothPriceFrom: Number(payload.boothPriceFrom) || 0,
        tags: String(payload.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      if (editing) await api.expos.update(editing._id, body);
      else await api.expos.create(body);
      return body;
    });

  const handleSave = async () => {
    const result = await save(form.values);
    if (result.ok) {
      toast.success(editing ? 'Expo updated' : 'Expo created');
      setModalOpen(false);
      list.reload();
    }
  };

  const changeStatus = async (expo, status) => {
    try {
      await api.expos.updateStatus(expo._id, { status });
      toast.success(`Expo marked as ${status}`);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Status could not be changed');
    }
  };

  const publish = async (expo) => {
    try {
      await api.expos.publish(expo._id);
      toast.success('Expo published — registration is now open');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The expo could not be published');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.expos.remove(pendingDelete._id);
      toast.success('Expo deleted');
      setPendingDelete(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The expo could not be deleted');
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Expo',
        render: (row) => (
          <div className="min-w-[220px]">
            <p className="font-medium text-slate-900 dark:text-white">{row.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {titleCase(row.category)} · {row.theme || 'No theme'}
            </p>
          </div>
        ),
      },
      { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
      {
        key: 'dates',
        label: 'Dates',
        render: (row) => (
          <div className="text-xs">
            <p>
              {formatDate(row.startDate)} → {formatDate(row.endDate)}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Deadline {row.registrationDeadline ? formatDate(row.registrationDeadline) : 'open'}
            </p>
          </div>
        ),
      },
      {
        key: 'location',
        label: 'Location',
        render: (row) => (
          <div className="text-xs">
            <p>{row.location?.venue || '—'}</p>
            <p className="text-slate-500 dark:text-slate-400">{[row.location?.city, row.location?.country].filter(Boolean).join(', ')}</p>
          </div>
        ),
      },
      { key: 'registrations', label: 'Attendees', render: (row) => <span className="text-sm font-medium">{row.stats?.registeredCount || 0}</span> },
      { key: 'ticketPrice', label: 'Ticket', render: (row) => <span className="text-sm">{row.ticketPrice > 0 ? formatCurrency(row.ticketPrice, row.currency) : 'Free'}</span> },
      {
        key: 'actions',
        label: '',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1.5">
            <Link to={`/expos/${row.slug || row._id}`}>
              <Button size="xs" variant="secondary" icon="eye">
                View
              </Button>
            </Link>
            <Button size="xs" variant="ghost" icon="pencil" onClick={() => openEdit(row)}>
              Edit
            </Button>
            <Dropdown
              align="right"
              trigger={
                <Button size="xs" variant="ghost" icon="chevron-down">
                  More
                </Button>
              }
            >
              {row.status === 'draft' && <DropdownItem icon="upload" onClick={() => publish(row)}>Publish expo</DropdownItem>}
              {EXPO_STATUSES.filter((status) => status !== row.status).map((status) => (
                <DropdownItem key={status} icon="refresh" onClick={() => changeStatus(row, status)}>
                  Mark as {titleCase(status)}
                </DropdownItem>
              ))}
              <DropdownItem icon="map" onClick={() => navigate(`/admin/booths?expo=${row._id}`)}>
                Manage booths
              </DropdownItem>
              <DropdownItem icon="chart" onClick={() => navigate(`/admin/analytics?expo=${row._id}`)}>
                Analytics
              </DropdownItem>
              <DropdownItem icon="trash" tone="danger" onClick={() => setPendingDelete(row)}>
                Delete expo
              </DropdownItem>
            </Dropdown>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  );

  return (
    <div>
      <PageHeader
        title="Expos"
        subtitle="Create and manage every expo: dates, venue, theme, capacity, pricing and publishing."
        icon="calendar"
        actions={
          <Button icon="plus" onClick={openCreate}>
            Create expo
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search expos by title, city or venue…"
        onReset={list.reset}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: EXPO_STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
            onChange: (value) => list.setFilter('status', value),
          },
          {
            name: 'category',
            label: 'Category',
            value: list.filters.category || '',
            options: EXPO_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) })),
            onChange: (value) => list.setFilter('category', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={6} columns={6} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={
            <div className="card card-pad text-center">
              <p className="text-sm font-medium">No expos yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create your first expo to open exhibitor applications.</p>
              <Button className="mt-4" icon="plus" onClick={openCreate}>
                Create expo
              </Button>
            </div>
          }
        />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title={editing ? `Edit ${editing.title}` : 'Create a new expo'}
        subtitle="Expos start as drafts — publish when the venue and programme are ready."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={form.submitting} onClick={handleSave}>
              {editing ? 'Save changes' : 'Create expo'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={form.errors.title} className="sm:col-span-2">
            <Input name="title" value={form.values.title} onChange={form.handleChange} placeholder="Green Energy Summit 2027" />
          </Field>
          <Field label="Summary" hint="Shown in listings and cards." className="sm:col-span-2">
            <Input name="summary" value={form.values.summary} onChange={form.handleChange} maxLength={300} />
          </Field>
          <Field label="Description" required error={form.errors.description} className="sm:col-span-2">
            <Textarea name="description" rows={4} value={form.values.description} onChange={form.handleChange} />
          </Field>
          <Field label="Theme">
            <Input name="theme" value={form.values.theme} onChange={form.handleChange} placeholder="Sustainable futures" />
          </Field>
          <Field label="Category">
            <Select
              name="category"
              value={form.values.category}
              onChange={form.handleChange}
              options={EXPO_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) }))}
            />
          </Field>
          <Field label="Start date" required error={form.errors.startDate}>
            <Input type="date" name="startDate" value={form.values.startDate} onChange={form.handleChange} />
          </Field>
          <Field label="End date" required error={form.errors.endDate}>
            <Input type="date" name="endDate" value={form.values.endDate} onChange={form.handleChange} />
          </Field>
          <Field label="Registration deadline">
            <Input type="date" name="registrationDeadline" value={form.values.registrationDeadline} onChange={form.handleChange} />
          </Field>
          <Field label="Status">
            <Select name="status" value={form.values.status} onChange={form.handleChange} options={EXPO_STATUSES.map((status) => ({ value: status, label: titleCase(status) }))} />
          </Field>
          <Field label="Venue">
            <Input name="location.venue" value={form.values.location.venue} onChange={(event) => form.setValue('location', { ...form.values.location, venue: event.target.value })} />
          </Field>
          <Field label="City">
            <Input name="location.city" value={form.values.location.city} onChange={(event) => form.setValue('location', { ...form.values.location, city: event.target.value })} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input name="location.address" value={form.values.location.address} onChange={(event) => form.setValue('location', { ...form.values.location, address: event.target.value })} />
          </Field>
          <Field label="Maximum attendees">
            <Input type="number" min="0" name="maxAttendees" value={form.values.maxAttendees} onChange={form.handleChange} />
          </Field>
          <Field label="Ticket price" hint="0 = free entry">
            <Input type="number" min="0" step="0.01" name="ticketPrice" value={form.values.ticketPrice} onChange={form.handleChange} />
          </Field>
          <Field label="Booth price from">
            <Input type="number" min="0" step="0.01" name="boothPriceFrom" value={form.values.boothPriceFrom} onChange={form.handleChange} />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input name="tags" value={form.values.tags} onChange={form.handleChange} placeholder="renewables, solar, storage" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={busy}
        title="Delete this expo?"
        confirmLabel="Delete expo"
        message={`"${pendingDelete?.title}" and its schedule, booths and registrations will be removed. This cannot be undone.`}
      />
    </div>
  );
};

export default AdminExpos;
