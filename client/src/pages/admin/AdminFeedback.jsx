import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Modal, Select, StarRating, Table, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const CATEGORIES = ['general', 'session', 'exhibitor', 'venue', 'app', 'website', 'payment', 'accessibility'];
const STATUSES = ['new', 'reviewed', 'resolved', 'archived'];

const AdminFeedback = () => {
  const toast = useToast();
  const stats = useApi(() => api.analytics.feedback(), []);
  const list = useListQuery((query) => api.feedback.list(query), { limit: 12 });
  const [active, setActive] = useState(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('reviewed');
  const [busy, setBusy] = useState(false);

  const openFeedback = (item) => {
    setActive(item);
    setResponse(item.response || '');
    setStatus(item.status === 'new' ? 'reviewed' : item.status);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.feedback.respond(active._id, { response, status });
      toast.success('Feedback updated');
      setActive(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The response could not be saved');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'subject',
      label: 'Feedback',
      render: (row) => (
        <div className="max-w-sm">
          <p className="truncate text-sm font-medium">{row.subject}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.message}</p>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'From',
      render: (row) => (
        <span className="text-xs">
          {row.isAnonymous ? 'Anonymous' : row.user?.name || row.name || 'Guest'}
          <span className="block text-slate-500 dark:text-slate-400">{titleCase(row.role || row.user?.role || '')}</span>
        </span>
      ),
    },
    { key: 'category', label: 'Category', render: (row) => <span className="badge-neutral">{titleCase(row.category)}</span> },
    { key: 'rating', label: 'Rating', render: (row) => (row.rating ? <StarRating value={row.rating} size="sm" showValue={false} /> : <span className="text-xs text-slate-400">—</span>) },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    { key: 'createdAt', label: 'Received', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <Button size="xs" icon="message" onClick={() => openFeedback(row)}>
          Respond
        </Button>
      ),
    },
  ];

  const statusCounts = stats.data?.byStatus || [];

  return (
    <div>
      <PageHeader title="Feedback" subtitle="Reviews, suggestions and issue reports from attendees and exhibitors." icon="message" />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {(statusCounts.length ? statusCounts : STATUSES.map((item) => ({ status: item, count: 0 }))).map((item) => (
          <Card key={item.status} className="card-pad">
            <p className="stat-label">{titleCase(item.status)}</p>
            <p className="stat-value mt-1">{item.count}</p>
          </Card>
        ))}
      </div>

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search feedback by subject or message…"
        onReset={list.reset}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: STATUSES.map((item) => ({ value: item, label: titleCase(item) })),
            onChange: (value) => list.setFilter('status', value),
          },
          {
            name: 'category',
            label: 'Category',
            value: list.filters.category || '',
            options: CATEGORIES.map((item) => ({ value: item, label: titleCase(item) })),
            onChange: (value) => list.setFilter('category', value),
          },
        ]}
        right={
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Avg rating {Number(stats.data?.averageRating || 0).toFixed(1)} / 5
          </p>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={5} />}>
        <Table columns={columns} rows={list.items} empty={<EmptyState icon="message" title="No feedback yet" message="Feedback submitted through the public form and dashboards lands here." />} />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.subject}
        subtitle={active ? `${titleCase(active.category)} · ${formatDateTime(active.createdAt)}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button icon="send" loading={busy} onClick={submit}>
              Save response
            </Button>
          </>
        }
      >
        {active && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="text-sm text-slate-700 dark:text-slate-200">{active.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{active.isAnonymous ? 'Anonymous' : active.user?.name || active.name || 'Guest'}</span>
                {active.expo?.title && <span>· {active.expo.title}</span>}
                {active.rating && <StarRating value={active.rating} size="sm" />}
              </div>
            </div>

            <Field label="Your response" hint="The author is notified when a response is saved.">
              <Textarea rows={4} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Thanks for the detailed feedback — we have…" />
            </Field>

            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)} options={STATUSES.map((item) => ({ value: item, label: titleCase(item) }))} />
            </Field>

            {active.response && (
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Previously answered by {active.respondedBy?.name || 'the team'} on {formatDateTime(active.respondedAt)}.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminFeedback;
