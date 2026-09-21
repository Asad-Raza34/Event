import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Input, Modal, Select, Table, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { ConfirmDialog } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const AUDIENCES = ['all', 'attendees', 'exhibitors', 'speakers'];
const PRIORITIES = ['normal', 'high', 'urgent'];

const AdminAnnouncements = () => {
  const toast = useToast();
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true' }), []);
  const list = useListQuery((query) => api.announcements.list(query), { limit: 12 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = useForm({ expo: '', title: '', body: '', audience: 'all', priority: 'normal', pinned: false, expiresAt: '' });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      expo: list.filters.expo || expos.data?.[0]?._id || '',
      title: '',
      body: '',
      audience: 'all',
      priority: 'normal',
      pinned: false,
      expiresAt: '',
    });
    setModalOpen(true);
  };

  const openEdit = (announcement) => {
    setEditing(announcement);
    form.reset({
      expo: announcement.expo?._id || announcement.expo,
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      priority: announcement.priority,
      pinned: announcement.pinned,
      expiresAt: announcement.expiresAt ? announcement.expiresAt.slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    const result = await form.submit(async (values) => {
      const payload = { ...values, expiresAt: values.expiresAt || undefined };
      return editing ? api.expos.updateAnnouncement(editing._id, payload) : api.expos.createAnnouncement(values.expo, payload);
    });
    if (result.ok) {
      toast.success(editing ? 'Announcement updated' : 'Announcement published to the selected audience');
      setModalOpen(false);
      list.reload();
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.expos.removeAnnouncement(pendingDelete._id);
      toast.success('Announcement deleted');
      setPendingDelete(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The announcement could not be deleted');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Announcement',
      render: (row) => (
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{row.title}</p>
            {row.pinned && <Badge tone="info">Pinned</Badge>}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{truncate(row.body, 110)}</p>
        </div>
      ),
    },
    { key: 'expo', label: 'Expo', render: (row) => <span className="text-sm">{row.expo?.title || '—'}</span> },
    { key: 'audience', label: 'Audience', render: (row) => <span className="badge-neutral">{titleCase(row.audience)}</span> },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => <Badge tone={row.priority === 'urgent' ? 'danger' : row.priority === 'high' ? 'warning' : 'neutral'}>{titleCase(row.priority)}</Badge>,
    },
    { key: 'recipients', label: 'Recipients', render: (row) => <span className="text-sm">{row.recipientCount || 0}</span> },
    { key: 'publishedAt', label: 'Published', render: (row) => <span className="text-xs">{formatDateTime(row.publishedAt || row.createdAt)}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="xs" variant="secondary" icon="pencil" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="xs" variant="ghost" icon="trash" onClick={() => setPendingDelete(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Broadcast schedule changes, venue notices and reminders — delivered in real time and archived here."
        icon="megaphone"
        actions={
          <Button icon="plus" onClick={openCreate} disabled={!expos.data?.length}>
            New announcement
          </Button>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search announcements…"
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
            name: 'audience',
            label: 'Audience',
            value: list.filters.audience || '',
            options: AUDIENCES.map((audience) => ({ value: audience, label: titleCase(audience) })),
            onChange: (value) => list.setFilter('audience', value),
          },
        ]}
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={6} columns={5} />}>
        <Table
          columns={columns}
          rows={list.items}
          empty={
            <EmptyState
              icon="megaphone"
              title="No announcements yet"
              message="Publish your first announcement to notify attendees and exhibitors instantly."
              action={
                <Button icon="plus" onClick={openCreate}>
                  New announcement
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
        title={editing ? 'Edit announcement' : 'Publish an announcement'}
        subtitle="Recipients get an in-app notification immediately; urgent items surface at the top."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button icon="megaphone" loading={form.submitting} onClick={save} disabled={!form.values.title || !form.values.body || !form.values.expo}>
              {editing ? 'Save changes' : 'Publish announcement'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Expo" required error={form.errors.expo}>
            <Select
              name="expo"
              value={form.values.expo}
              placeholder="Select an expo"
              options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
              onChange={form.handleChange}
            />
          </Field>
          <Field label="Title" required error={form.errors.title}>
            <Input name="title" value={form.values.title} onChange={form.handleChange} placeholder="Keynote moved to Hall B" />
          </Field>
          <Field label="Message" required error={form.errors.body}>
            <Textarea name="body" rows={5} value={form.values.body} onChange={form.handleChange} placeholder="Doors open 30 minutes earlier than planned…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Audience">
              <Select name="audience" value={form.values.audience} onChange={form.handleChange} options={AUDIENCES.map((audience) => ({ value: audience, label: titleCase(audience) }))} />
            </Field>
            <Field label="Priority">
              <Select name="priority" value={form.values.priority} onChange={form.handleChange} options={PRIORITIES.map((priority) => ({ value: priority, label: titleCase(priority) }))} />
            </Field>
            <Field label="Expires" hint="Optional">
              <Input type="date" name="expiresAt" value={form.values.expiresAt} onChange={form.handleChange} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="checkbox" name="pinned" checked={form.values.pinned} onChange={form.handleChange} />
            Pin this announcement to the top of the feed
          </label>
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <Icon name="bell" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Attendees and exhibitors registered for this expo receive the notification instantly.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        loading={busy}
        title="Delete this announcement?"
        confirmLabel="Delete"
        message={`"${pendingDelete?.title}" will be removed from attendee dashboards.`}
      />
    </div>
  );
};

export default AdminAnnouncements;
