import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useForm } from '../../hooks/useForm';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate, formatTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, StatCard, Table, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const DURATIONS = [15, 20, 30, 45, 60];

const ExhibitorAvailability = () => {
  const { user } = useAuth();
  const toast = useToast();
  const expos = useApi(() => api.expos.list({ limit: 100, upcoming: 'true', sort: 'startDate' }), []);
  const list = useListQuery((query) => api.appointments.slots({ ...query, exhibitorUser: user?._id }), { limit: 12 }, [user?._id]);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useForm({
    expo: '',
    startDate: '',
    endDate: '',
    startTime: '10:00',
    endTime: '16:00',
    durationMinutes: 30,
    location: '',
    meetingLink: '',
    note: '',
  });

  const createSlots = async () => {
    const result = await form.submit((values) => {
      const dates = [];
      if (values.startDate) {
        const start = new Date(values.startDate);
        const end = values.endDate ? new Date(values.endDate) : start;
        for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
          dates.push(new Date(day).toISOString().slice(0, 10));
        }
      }
      return api.appointments.createSlots({
        expo: values.expo,
        dates,
        startTime: values.startTime,
        endTime: values.endTime,
        durationMinutes: Number(values.durationMinutes),
        location: values.location,
        meetingLink: values.meetingLink,
        note: values.note,
      });
    });
    if (result.ok) {
      toast.success(`${result.data.data.created} slots published`);
      setCreateOpen(false);
      list.reload();
    }
  };

  const updateStatus = async (slot, status) => {
    try {
      await api.appointments.updateSlot(slot._id, { status });
      toast.success(`Slot marked ${status}`);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not update the slot');
    }
  };

  const removeSlot = async () => {
    setBusy(true);
    try {
      await api.appointments.removeSlot(pendingDelete._id);
      toast.success('Slot removed');
      setPendingDelete(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not remove the slot');
    } finally {
      setBusy(false);
    }
  };

  const openCount = list.items.filter((slot) => slot.status === 'open').length;
  const bookedCount = list.items.filter((slot) => slot.status === 'booked').length;

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (row) => (
        <div className="text-sm">
          <p className="font-medium">{formatDate(row.date, { weekday: 'short' })}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatTime(row.startTime)} – {formatTime(row.endTime)}
          </p>
        </div>
      ),
    },
    { key: 'duration', label: 'Duration', render: (row) => <span className="text-sm">{row.durationMinutes} min</span> },
    { key: 'expo', label: 'Expo', render: (row) => <span className="text-xs">{row.expo?.title}</span> },
    { key: 'location', label: 'Location', render: (row) => <span className="text-xs">{row.location || 'Your booth'}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'booked' ? 'confirmed' : row.status} dot /> },
    { key: 'bookedBy', label: 'Booked by', render: (row) => <span className="text-xs">{row.bookedBy?.name || '—'}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {row.status === 'open' && (
            <Button size="xs" variant="ghost" onClick={() => updateStatus(row, 'blocked')}>
              Block
            </Button>
          )}
          {row.status === 'blocked' && (
            <Button size="xs" variant="secondary" onClick={() => updateStatus(row, 'open')}>
              Reopen
            </Button>
          )}
          {row.status !== 'booked' && (
            <Button size="xs" variant="ghost" icon="trash" onClick={() => setPendingDelete(row)} aria-label="Delete slot" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Availability"
        subtitle="Publish the time slots attendees can book meetings in — they are approved by you before they are confirmed."
        icon="clock"
        actions={
          <Button icon="plus" onClick={() => setCreateOpen(true)} disabled={!expos.data?.length}>
            Publish slots
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open slots" value={openCount} hint="Awaiting bookings" icon="clock" tone="success" />
        <StatCard label="Booked slots" value={bookedCount} hint="Meetings scheduled" icon="handshake" tone="brand" />
        <StatCard label="Total published" value={list.meta?.total ?? 0} icon="calendar" tone="info" />
      </div>

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search slots…"
        onReset={list.reset}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: [
              { value: 'open', label: 'Open' },
              { value: 'booked', label: 'Booked' },
              { value: 'blocked', label: 'Blocked' },
            ],
            onChange: (value) => list.setFilter('status', value),
          },
          {
            name: 'availableOnly',
            label: 'Timing',
            value: list.filters.availableOnly || '',
            placeholder: 'Any date',
            options: [{ value: 'true', label: 'From today' }],
            onChange: (value) => list.setFilter('availableOnly', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={5} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={
            <EmptyState
              icon="clock"
              title="No availability published"
              message="Publish slots so attendees can request meetings with your team."
              action={
                <Button icon="plus" onClick={() => setCreateOpen(true)} disabled={!expos.data?.length}>
                  Publish slots
                </Button>
              }
            />
          }
        />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        size="lg"
        title="Publish meeting slots"
        subtitle="Slots are generated for every day between the start and end date, using the time range below."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button icon="clock" loading={form.submitting} onClick={createSlots} disabled={!form.values.expo || !form.values.startDate}>
              Publish slots
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expo" required error={form.errors.expo} className="sm:col-span-2">
            <Select
              name="expo"
              value={form.values.expo}
              placeholder="Choose an expo"
              options={(expos.data || []).map((expo) => ({ value: expo._id, label: `${expo.title} · ${formatDate(expo.startDate)}` }))}
              onChange={form.handleChange}
            />
          </Field>
          <Field label="First day" required>
            <Input type="date" name="startDate" value={form.values.startDate} onChange={form.handleChange} />
          </Field>
          <Field label="Last day" hint="Leave empty for a single day">
            <Input type="date" name="endDate" value={form.values.endDate} onChange={form.handleChange} />
          </Field>
          <Field label="Day starts" required>
            <Input type="time" name="startTime" value={form.values.startTime} onChange={form.handleChange} />
          </Field>
          <Field label="Day ends" required>
            <Input type="time" name="endTime" value={form.values.endTime} onChange={form.handleChange} />
          </Field>
          <Field label="Meeting length">
            <Select
              name="durationMinutes"
              value={String(form.values.durationMinutes)}
              options={DURATIONS.map((duration) => ({ value: String(duration), label: `${duration} minutes` }))}
              onChange={(event) => form.setValue('durationMinutes', Number(event.target.value))}
            />
          </Field>
          <Field label="Location">
            <Input name="location" value={form.values.location} onChange={form.handleChange} placeholder="Booth A-12 meeting table" />
          </Field>
          <Field label="Meeting link" className="sm:col-span-2">
            <Input name="meetingLink" value={form.values.meetingLink} onChange={form.handleChange} placeholder="https://meet.example.com/team" />
          </Field>
          <Field label="Note for attendees" className="sm:col-span-2">
            <Textarea name="note" rows={2} value={form.values.note} onChange={form.handleChange} placeholder="Bring your spec sheets — we will walk through integration options." />
          </Field>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Slot length is fixed by the meeting length; overlapping existing slots are skipped automatically.
        </p>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={removeSlot}
        loading={busy}
        title="Remove this slot?"
        confirmLabel="Remove slot"
        message="Attendees will no longer be able to book this time."
      />
    </div>
  );
};

export default ExhibitorAvailability;
