import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { BOOTH_SIZES, BOOTH_STATUSES, BOOTH_ZONES } from '../../lib/constants';
import { formatCurrency, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Input, Modal, Select, Table, Textarea, Tabs } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const AdminBooths = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const expoId = params.get('expo') || '';
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true', sort: '-startDate' }), []);
  const exhibitors = useApi(() => api.exhibitors.directory({ limit: 100 }), []);
  const [tab, setTab] = useState('booths');
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!expoId && expos.data?.length) {
      setParams({ expo: expos.data[0]._id }, { replace: true });
    }
  }, [expoId, expos.data, setParams]);

  const list = useListQuery((query) => api.booths.list({ ...query, expo: expoId }), { limit: 12 }, [expoId]);
  const pending = useApi(() => api.booths.pending({ expo: expoId || undefined }), [expoId], { enabled: tab === 'requests' });

  const boothForm = useForm({ number: '', name: '', zone: 'A', size: 'medium', price: 0, description: '', amenities: '' });
  const bulkForm = useForm({ zone: 'A', rows: 3, cols: 4, size: 'medium', price: 1200, startNumber: 1, namePrefix: '' });
  const assignForm = useForm({ exhibitorId: '', skipPayment: false });

  const openCreate = () => {
    setEditing(null);
    boothForm.reset({ number: '', name: '', zone: 'A', size: 'medium', price: 0, description: '', amenities: '' });
    setModalOpen(true);
  };

  const openEdit = (booth) => {
    setEditing(booth);
    boothForm.reset({
      number: booth.number,
      name: booth.name || '',
      zone: booth.zone || 'A',
      size: booth.size,
      price: booth.price || 0,
      description: booth.description || '',
      amenities: (booth.amenities || []).join(', '),
    });
    setModalOpen(true);
  };

  const saveBooth = async () => {
    const result = await boothForm.submit(async (values) => {
      const body = {
        expo: expoId,
        number: values.number,
        name: values.name,
        zone: values.zone,
        size: values.size,
        price: Number(values.price) || 0,
        description: values.description,
        amenities: String(values.amenities || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      };
      return editing ? api.booths.update(editing._id, body) : api.booths.create(body);
    });
    if (result.ok) {
      toast.success(editing ? 'Booth updated' : 'Booth created');
      setModalOpen(false);
      list.reload();
    }
  };

  const generateBulk = async () => {
    const result = await bulkForm.submit((values) =>
      api.expos.bulkBooths(expoId, {
        zone: values.zone,
        rows: Number(values.rows),
        cols: Number(values.cols),
        size: values.size,
        price: Number(values.price),
        startNumber: Number(values.startNumber),
        namePrefix: values.namePrefix,
      }),
    );
    if (result.ok) {
      toast.success(`${result.data.data.created} booths generated`);
      setBulkOpen(false);
      list.reload();
    }
  };

  const quickStatus = async (booth, status) => {
    try {
      await api.booths.updateStatus(booth._id, { status });
      toast.success(`Booth ${booth.zone}-${booth.number} marked ${status}`);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not update the booth');
    }
  };

  const assignBooth = async () => {
    setBusy(true);
    try {
      const payload = { exhibitorId: assignForm.values.exhibitorId };
      await api.booths.assign(assignTarget._id, payload);
      toast.success('Booth assigned');
      setAssignTarget(null);
      list.reload();
      pending.reload();
    } catch (error) {
      toast.error(error?.message || 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  const releaseBooth = async () => {
    setBusy(true);
    try {
      await api.booths.release(pendingAction.booth._id, { reason: 'Released by organizer' });
      toast.success('Booth released');
      setPendingAction(null);
      list.reload();
      pending.reload();
    } catch (error) {
      toast.error(error?.message || 'Release failed');
    } finally {
      setBusy(false);
    }
  };

  const reviewRequest = async (request, action) => {
    setBusy(true);
    try {
      if (action === 'approve') await api.booths.approve(request.booth._id, { note: 'Approved by organizer' });
      else await api.booths.reject(request.booth._id, { reason: 'Request declined by organizer' });
      toast.success(action === 'approve' ? 'Reservation approved' : 'Reservation declined');
      pending.reload();
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The request could not be processed');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'number',
      label: 'Booth',
      render: (row) => (
        <div>
          <p className="font-semibold">
            {row.zone}-{row.number}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.name || titleCase(row.size)}</p>
        </div>
      ),
    },
    { key: 'size', label: 'Size', render: (row) => titleCase(row.size) },
    { key: 'price', label: 'Price', render: (row) => formatCurrency(row.price, row.currency) },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    {
      key: 'exhibitor',
      label: 'Exhibitor',
      render: (row) =>
        row.exhibitor ? (
          <span className="text-sm">{row.exhibitor.companyName}</span>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        ),
    },
    {
      key: 'traffic',
      label: 'Traffic',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.traffic?.views || 0} views · {row.traffic?.checkIns || 0} scans
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button size="xs" variant="ghost" icon="pencil" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="xs" variant="secondary" icon="users" onClick={() => {
            assignForm.reset({ exhibitorId: '', skipPayment: false });
            setAssignTarget(row);
          }}>
            Assign
          </Button>
          {row.status !== 'available' && (
            <Button size="xs" variant="ghost" onClick={() => setPendingAction({ booth: row, kind: 'release' })}>
              Release
            </Button>
          )}
          {row.status !== 'maintenance' ? (
            <Button size="xs" variant="ghost" onClick={() => quickStatus(row, 'maintenance')}>
              Maintenance
            </Button>
          ) : (
            <Button size="xs" variant="ghost" onClick={() => quickStatus(row, 'available')}>
              Reopen
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Booths"
        subtitle="Lay out the hall, generate booths in bulk, assign exhibitors and approve reservation requests."
        icon="map"
        actions={
          <>
            <Select
              value={expoId}
              className="min-w-[220px]"
              placeholder="Select an expo"
              options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
              onChange={(event) => setParams({ expo: event.target.value }, { replace: true })}
              aria-label="Select expo"
            />
            <Button variant="secondary" icon="layers" onClick={() => setBulkOpen(true)} disabled={!expoId}>
              Bulk generate
            </Button>
            <Button icon="plus" onClick={openCreate} disabled={!expoId}>
              New booth
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'booths', label: 'All booths', icon: 'map', count: list.meta?.total },
            { value: 'requests', label: 'Reservation requests', icon: 'clipboard' },
          ]}
        />
      </div>

      {!expoId ? (
        <EmptyState icon="calendar" title="Choose an expo" message="Select an expo above to manage its booths." />
      ) : tab === 'booths' ? (
        <>
          <FilterBar
            search={list.search}
            onSearch={list.setSearch}
            searchPlaceholder="Search by booth number, name or zone…"
            onReset={list.reset}
            filters={[
              {
                name: 'status',
                label: 'Status',
                value: list.filters.status || '',
                options: BOOTH_STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
                onChange: (value) => list.setFilter('status', value),
              },
              {
                name: 'zone',
                label: 'Zone',
                value: list.filters.zone || '',
                options: BOOTH_ZONES.map((zone) => ({ value: zone, label: `Zone ${zone}` })),
                onChange: (value) => list.setFilter('zone', value),
              },
              {
                name: 'size',
                label: 'Size',
                value: list.filters.size || '',
                options: BOOTH_SIZES.map((size) => ({ value: size, label: titleCase(size) })),
                onChange: (value) => list.setFilter('size', value),
              },
            ]}
          />
          <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={6} columns={6} />}>
            <Table
              columns={columns}
              rows={list.items}
              empty={
                <div className="card card-pad text-center">
                  <p className="text-sm font-medium">No booths yet</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Generate a grid of booths to get started.</p>
                  <Button className="mt-4" icon="layers" onClick={() => setBulkOpen(true)}>
                    Bulk generate booths
                  </Button>
                </div>
              }
            />
            <Pagination meta={list.meta} onPageChange={list.setPage} />
          </DataState>
        </>
      ) : (
        <DataState loading={pending.loading} error={pending.error} onRetry={pending.reload}>
          {(pending.data || []).length === 0 ? (
            <EmptyState icon="clipboard" title="No pending reservation requests" message="Exhibitor booth requests will appear here for approval." />
          ) : (
            <div className="space-y-3">
              {pending.data.map((request) => (
                <Card key={request._id} className="flex flex-wrap items-center gap-4 p-5">
                  <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {request.zone}-{request.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {request.reservation?.exhibitor?.companyName || request.exhibitor?.companyName || 'Exhibitor request'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {titleCase(request.size)} · {formatCurrency(request.price, request.currency)} · requested{' '}
                      {request.reservation?.requestedAt ? new Date(request.reservation.requestedAt).toLocaleString() : 'recently'}
                    </p>
                    {request.reservation?.note && <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">“{request.reservation.note}”</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="success" icon="check" loading={busy} onClick={() => reviewRequest(request, 'approve')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" icon="x" loading={busy} onClick={() => reviewRequest(request, 'reject')}>
                      Decline
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </DataState>
      )}

      {/* ------------------------------------------------------- booth form */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit booth ${editing.zone}-${editing.number}` : 'Create a booth'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={boothForm.submitting} onClick={saveBooth}>
              {editing ? 'Save booth' : 'Create booth'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Booth number" required error={boothForm.errors.number}>
            <Input name="number" value={boothForm.values.number} onChange={boothForm.handleChange} placeholder="12" />
          </Field>
          <Field label="Zone">
            <Select name="zone" value={boothForm.values.zone} onChange={boothForm.handleChange} options={BOOTH_ZONES.map((zone) => ({ value: zone, label: `Zone ${zone}` }))} />
          </Field>
          <Field label="Name">
            <Input name="name" value={boothForm.values.name} onChange={boothForm.handleChange} placeholder="Innovation corner" />
          </Field>
          <Field label="Size">
            <Select name="size" value={boothForm.values.size} onChange={boothForm.handleChange} options={BOOTH_SIZES.map((size) => ({ value: size, label: titleCase(size) }))} />
          </Field>
          <Field label="Price">
            <Input type="number" min="0" step="0.01" name="price" value={boothForm.values.price} onChange={boothForm.handleChange} />
          </Field>
          <Field label="Amenities" hint="Comma separated">
            <Input name="amenities" value={boothForm.values.amenities} onChange={boothForm.handleChange} placeholder="power, lighting, storage" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea name="description" rows={3} value={boothForm.values.description} onChange={boothForm.handleChange} />
          </Field>
        </div>
      </Modal>

      {/* -------------------------------------------------------- bulk form */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Generate booths in bulk"
        subtitle="Creates a grid of numbered booths inside the selected expo."
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button icon="layers" loading={bulkForm.submitting} onClick={generateBulk}>
              Generate booths
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zone">
            <Select name="zone" value={bulkForm.values.zone} onChange={bulkForm.handleChange} options={BOOTH_ZONES.map((zone) => ({ value: zone, label: `Zone ${zone}` }))} />
          </Field>
          <Field label="Size">
            <Select name="size" value={bulkForm.values.size} onChange={bulkForm.handleChange} options={BOOTH_SIZES.map((size) => ({ value: size, label: titleCase(size) }))} />
          </Field>
          <Field label="Rows" hint="1–30">
            <Input type="number" min="1" max="30" name="rows" value={bulkForm.values.rows} onChange={bulkForm.handleChange} />
          </Field>
          <Field label="Columns" hint="1–30">
            <Input type="number" min="1" max="30" name="cols" value={bulkForm.values.cols} onChange={bulkForm.handleChange} />
          </Field>
          <Field label="Start number">
            <Input type="number" min="1" name="startNumber" value={bulkForm.values.startNumber} onChange={bulkForm.handleChange} />
          </Field>
          <Field label="Price per booth">
            <Input type="number" min="0" step="0.01" name="price" value={bulkForm.values.price} onChange={bulkForm.handleChange} />
          </Field>
          <Field label="Name prefix" className="sm:col-span-2">
            <Input name="namePrefix" value={bulkForm.values.namePrefix} onChange={bulkForm.handleChange} placeholder="Startup row" />
          </Field>
        </div>
        <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
          {Number(bulkForm.values.rows) * Number(bulkForm.values.cols)} booths will be created in zone {bulkForm.values.zone}.
        </p>
      </Modal>

      {/* ------------------------------------------------------ assign form */}
      <Modal
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={`Assign ${assignTarget?.zone}-${assignTarget?.number}`}
        subtitle="Assign an approved exhibitor to this booth."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignTarget(null)}>
              Cancel
            </Button>
            <Button icon="users" loading={busy} disabled={!assignForm.values.exhibitorId} onClick={assignBooth}>
              Assign booth
            </Button>
          </>
        }
      >
        <Field label="Exhibitor" required>
          <Select
            value={assignForm.values.exhibitorId}
            placeholder="Choose an exhibitor"
            options={(exhibitors.data || []).map((exhibitor) => ({ value: exhibitor._id, label: exhibitor.companyName }))}
            onChange={(event) => assignForm.setValue('exhibitorId', event.target.value)}
          />
        </Field>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Assigning marks the booth as occupied and notifies the exhibitor with the booth details.
        </p>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={releaseBooth}
        loading={busy}
        title="Release this booth?"
        confirmLabel="Release booth"
        message="The exhibitor assignment will be removed and the booth becomes available again."
      />
    </div>
  );
};

export default AdminBooths;
