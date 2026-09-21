import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { SESSION_LEVELS, SESSION_TYPES } from '../../lib/constants';
import { formatDate, formatTime, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Field, Input, Modal, ProgressBar, Select, Table, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const emptySession = {
  expo: '',
  title: '',
  description: '',
  type: 'session',
  level: 'all',
  category: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  capacity: 100,
  speakers: [],
  tags: '',
  isFeatured: false,
};

const AdminSessions = () => {
  const toast = useToast();
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true' }), []);
  const speakers = useApi(() => api.speakers.list({ limit: 100 }), []);
  const list = useListQuery((query) => api.sessions.list(query), { limit: 12 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useForm(emptySession);

  const openCreate = () => {
    setEditing(null);
    form.reset({ ...emptySession, expo: list.filters.expo || expos.data?.[0]?._id || '' });
    setModalOpen(true);
  };

  const openEdit = (session) => {
    setEditing(session);
    form.reset({
      expo: session.expo?._id || session.expo,
      title: session.title,
      description: session.description || '',
      type: session.type,
      level: session.level || 'all',
      category: session.category || '',
      date: session.date?.slice(0, 10) || '',
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.location?.room || '',
      capacity: session.capacity || 100,
      speakers: (session.speakers || []).map((speaker) => speaker._id),
      tags: (session.tags || []).join(', '),
      isFeatured: Boolean(session.isFeatured),
    });
    setModalOpen(true);
  };

  const save = async () => {
    const result = await form.submit(async (values) => {
      const payload = {
        expo: values.expo,
        title: values.title,
        description: values.description,
        type: values.type,
        level: values.level,
        category: values.category,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        capacity: Number(values.capacity) || 1,
        speakers: values.speakers,
        isFeatured: values.isFeatured,
        location: { room: values.room },
        tags: String(values.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      return editing ? api.sessions.update(editing._id, payload) : api.sessions.create(payload);
    });
    if (result.ok) {
      toast.success(editing ? 'Session updated' : 'Session scheduled');
      setModalOpen(false);
      list.reload();
    }
  };

  const cancelSession = async () => {
    setBusy(true);
    try {
      await api.sessions.cancel(cancelTarget._id, { reason: cancelReason || 'Cancelled by organizer' });
      toast.success('Session cancelled — registered attendees were notified');
      setCancelTarget(null);
      setCancelReason('');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The session could not be cancelled');
    } finally {
      setBusy(false);
    }
  };

  const removeSession = async () => {
    setBusy(true);
    try {
      await api.sessions.remove(deleteTarget._id);
      toast.success('Session deleted');
      setDeleteTarget(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The session could not be deleted');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Session',
      render: (row) => (
        <div className="max-w-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{row.title}</p>
            {row.isFeatured && <Badge tone="warning">Featured</Badge>}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{truncate(row.description || '', 80)}</p>
        </div>
      ),
    },
    { key: 'type', label: 'Type', render: (row) => <span className="badge-neutral">{titleCase(row.type)}</span> },
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
    { key: 'room', label: 'Room', render: (row) => <span className="text-xs">{row.location?.room || '—'}</span> },
    {
      key: 'speakers',
      label: 'Speakers',
      render: (row) => <span className="text-xs">{(row.speakers || []).map((speaker) => speaker.name).join(', ') || '—'}</span>,
    },
    {
      key: 'capacity',
      label: 'Seats',
      render: (row) => (
        <div className="w-28">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {row.registeredCount || 0}/{row.capacity}
          </p>
          <ProgressBar className="mt-1" value={row.registeredCount || 0} max={row.capacity || 1} />
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Link to={`/sessions/${row._id}`}>
            <Button size="xs" variant="secondary" icon="eye">
              View
            </Button>
          </Link>
          <Button size="xs" variant="ghost" icon="pencil" onClick={() => openEdit(row)}>
            Edit
          </Button>
          {row.status !== 'cancelled' && (
            <Button size="xs" variant="ghost" onClick={() => setCancelTarget(row)}>
              Cancel
            </Button>
          )}
          <Button size="xs" variant="ghost" icon="trash" onClick={() => setDeleteTarget(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sessions"
        subtitle="Schedule keynotes, workshops, seminars and panels with speakers, rooms and seat capacity."
        icon="mic"
        actions={
          <Button icon="plus" onClick={openCreate} disabled={!expos.data?.length}>
            New session
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search sessions by title, tag or room…"
        onReset={list.reset}
        filters={[
          {
            name: 'expo',
            label: 'Expo',
            value: list.filters.expo || '',
            options: (expos.data || []).map((expo) => ({ value: expo._id, label: expo.title })),
            onChange: (value) => list.setFilter('expo', value),
          },
          {
            name: 'type',
            label: 'Type',
            value: list.filters.type || '',
            options: SESSION_TYPES.map((type) => ({ value: type, label: titleCase(type) })),
            onChange: (value) => list.setFilter('type', value),
          },
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: ['scheduled', 'ongoing', 'completed', 'cancelled'].map((status) => ({ value: status, label: titleCase(status) })),
            onChange: (value) => list.setFilter('status', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={6} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={
            <EmptyState
              icon="mic"
              title="No sessions scheduled"
              message="Build the programme by adding sessions, workshops and speakers."
              action={
                <Button icon="plus" onClick={openCreate} disabled={!expos.data?.length}>
                  New session
                </Button>
              }
            />
          }
        />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        title={editing ? `Edit ${editing.title}` : 'Schedule a session'}
        subtitle="Sessions appear on the public programme as soon as they are saved."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={form.submitting} onClick={save}>
              {editing ? 'Save session' : 'Schedule session'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expo" required error={form.errors.expo}>
            <Select
              name="expo"
              value={form.values.expo}
              placeholder="Select an expo"
              options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
              onChange={form.handleChange}
            />
          </Field>
          <Field label="Type">
            <Select name="type" value={form.values.type} onChange={form.handleChange} options={SESSION_TYPES.map((type) => ({ value: type, label: titleCase(type) }))} />
          </Field>
          <Field label="Title" required error={form.errors.title} className="sm:col-span-2">
            <Input name="title" value={form.values.title} onChange={form.handleChange} placeholder="Opening keynote — the next decade of clean energy" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea name="description" rows={3} value={form.values.description} onChange={form.handleChange} />
          </Field>
          <Field label="Date" required error={form.errors.date}>
            <Input type="date" name="date" value={form.values.date} onChange={form.handleChange} />
          </Field>
          <Field label="Room">
            <Input name="room" value={form.values.room} onChange={form.handleChange} placeholder="Hall B — Stage 2" />
          </Field>
          <Field label="Start time" required>
            <Input type="time" name="startTime" value={form.values.startTime} onChange={form.handleChange} />
          </Field>
          <Field label="End time" required>
            <Input type="time" name="endTime" value={form.values.endTime} onChange={form.handleChange} />
          </Field>
          <Field label="Capacity">
            <Input type="number" min="1" name="capacity" value={form.values.capacity} onChange={form.handleChange} />
          </Field>
          <Field label="Level">
            <Select name="level" value={form.values.level} onChange={form.handleChange} options={SESSION_LEVELS.map((level) => ({ value: level, label: titleCase(level) }))} />
          </Field>
          <Field label="Speakers" hint="Hold ⌘/Ctrl to select multiple" className="sm:col-span-2">
            <select
              multiple
              name="speakers"
              value={form.values.speakers}
              onChange={form.handleChange}
              className="input h-32"
            >
              {(speakers.data || []).map((speaker) => (
                <option key={speaker._id} value={speaker._id}>
                  {speaker.name} {speaker.organization ? `— ${speaker.organization}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <Input name="category" value={form.values.category} onChange={form.handleChange} placeholder="Energy" />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input name="tags" value={form.values.tags} onChange={form.handleChange} placeholder="keynote, energy, policy" />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="checkbox" name="isFeatured" checked={form.values.isFeatured} onChange={form.handleChange} />
            Feature this session on the public programme
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel this session?"
        subtitle={cancelTarget?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep session
            </Button>
            <Button variant="danger" icon="x" loading={busy} onClick={cancelSession}>
              Cancel session
            </Button>
          </>
        }
      >
        <Field label="Reason shared with attendees">
          <Textarea rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="The speaker is unavailable — a replacement session will be announced." />
        </Field>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Everyone registered for this session receives a cancellation notification.
        </p>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeSession}
        loading={busy}
        title="Delete this session?"
        confirmLabel="Delete session"
        message={`"${deleteTarget?.title}" will be permanently removed along with its registrations.`}
      />
    </div>
  );
};

export default AdminSessions;
