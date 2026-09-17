import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../../lib/constants';
import { formatDateTime, initials, mediaUrl, relativeTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Select, Table, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { Drawer } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const AdminSupport = () => {
  const toast = useToast();
  const list = useListQuery((query) => api.tickets.list(query), { limit: 12 });
  const stats = useApi(() => api.tickets.stats(), []);
  const [activeId, setActiveId] = useState(null);
  const detail = useApi(() => api.tickets.detail(activeId), [activeId], { enabled: Boolean(activeId) });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const ticket = detail.data;

  const sendReply = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.tickets.reply(activeId, { body: reply });
      setReply('');
      detail.reload();
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The reply could not be sent');
    } finally {
      setBusy(false);
    }
  };

  const updateTicket = async (payload) => {
    setBusy(true);
    try {
      await api.tickets.update(activeId, payload);
      toast.success('Ticket updated');
      detail.reload();
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The ticket could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'ticketNumber',
      label: 'Ticket',
      render: (row) => (
        <div className="max-w-sm">
          <p className="truncate text-sm font-medium">{row.subject}</p>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.ticketNumber}</p>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'Requester',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.user?.avatar ? (
            <img src={mediaUrl(row.user.avatar)} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold dark:bg-slate-800">
              {initials(row.user?.name || '?')}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{row.user?.name}</p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{titleCase(row.user?.role || '')}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', label: 'Category', render: (row) => <span className="badge-neutral">{titleCase(row.category)}</span> },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => <Badge tone={row.priority === 'urgent' ? 'danger' : row.priority === 'high' ? 'warning' : 'neutral'}>{titleCase(row.priority)}</Badge>,
    },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    { key: 'lastActivityAt', label: 'Updated', render: (row) => <span className="text-xs">{relativeTime(row.lastActivityAt)}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <Button size="xs" icon="chat" onClick={() => setActiveId(row._id)}>
          Open
        </Button>
      ),
    },
  ];

  const summary = stats.data || {};

  return (
    <div>
      <PageHeader title="Support tickets" subtitle="Answer questions, track issues and close the loop with attendees, exhibitors and organizers." icon="lifebuoy" />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(summary.byStatus?.length ? summary.byStatus : TICKET_STATUSES.map((status) => ({ status, count: 0 }))).map((item) => (
          <Card key={item.status} className="card-pad">
            <p className="stat-label">{titleCase(item.status)}</p>
            <p className="stat-value mt-1">{item.count}</p>
          </Card>
        ))}
      </div>

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by subject, description or ticket number…"
        onReset={list.reset}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: TICKET_STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
            onChange: (value) => list.setFilter('status', value),
          },
          {
            name: 'priority',
            label: 'Priority',
            value: list.filters.priority || '',
            options: TICKET_PRIORITIES.map((priority) => ({ value: priority, label: titleCase(priority) })),
            onChange: (value) => list.setFilter('priority', value),
          },
        ]}
        right={
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Avg resolution {summary.avgResolutionHours ? `${Math.round(summary.avgResolutionHours)}h` : '—'}
          </p>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={8} columns={6} />}>
        <Table columns={columns} rows={list.items} empty={<EmptyState icon="lifebuoy" title="No tickets" message="Support requests from every role arrive here." />} />
        <Pagination meta={list.meta} onPageChange={list.setPage} />
      </DataState>

      <Drawer open={Boolean(activeId)} onClose={() => setActiveId(null)} title={ticket ? ticket.subject : 'Ticket'} width="max-w-2xl">
        {detail.loading || !ticket ? (
          <div className="space-y-3">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={ticket.status} dot />
              <Badge tone={ticket.priority === 'urgent' ? 'danger' : 'neutral'}>{titleCase(ticket.priority)}</Badge>
              <span className="badge-neutral">{titleCase(ticket.category)}</span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{ticket.ticketNumber}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{ticket.user?.name}</span>
              <span>· {ticket.user?.email}</span>
              {ticket.relatedExpo?.title && <span>· {ticket.relatedExpo.title}</span>}
            </div>

            <Card className="card-pad">
              <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select
                  value={ticket.status}
                  options={TICKET_STATUSES.map((status) => ({ value: status, label: titleCase(status) }))}
                  onChange={(event) => updateTicket({ status: event.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Priority">
                <Select
                  value={ticket.priority}
                  options={TICKET_PRIORITIES.map((priority) => ({ value: priority, label: titleCase(priority) }))}
                  onChange={(event) => updateTicket({ priority: event.target.value })}
                  disabled={busy}
                />
              </Field>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Conversation</h3>
              <ul className="mt-3 space-y-3">
                {(ticket.messages || []).map((message) => (
                  <li key={message._id} className={message.author?.role === 'admin' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        message.author?.role === 'admin'
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                        {message.author?.name || 'Support'} · {formatDateTime(message.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap">{message.body}</p>
                    </div>
                  </li>
                ))}
                {(ticket.messages || []).length === 0 && (
                  <li className="text-sm text-slate-500 dark:text-slate-400">No replies yet — be the first to respond.</li>
                )}
              </ul>
            </div>

            <Field label="Reply to the requester">
              <Textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Thanks for reaching out — here is what we found…" />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button icon="send" loading={busy} disabled={!reply.trim()} onClick={sendReply}>
                Send reply
              </Button>
              {ticket.status !== 'resolved' && (
                <Button variant="secondary" icon="check" onClick={() => updateTicket({ status: 'resolved', note: 'Marked as resolved' })}>
                  Mark resolved
                </Button>
              )}
              {ticket.status !== 'closed' && (
                <Button variant="ghost" icon="x" onClick={() => updateTicket({ status: 'closed' })}>
                  Close ticket
                </Button>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Status changes notify the requester automatically through the notification bell.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AdminSupport;
