import { useMemo, useState } from 'react';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatDate, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/overlay';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const STATUS_TABS = [
  { value: 'all', label: 'All', icon: 'grid' },
  { value: 'open', label: 'Open', icon: 'mail' },
  { value: 'responded', label: 'Responded', icon: 'check' },
  { value: 'closed', label: 'Closed', icon: 'lock' },
];

const AttendeeFeedback = () => {
  const toast = useToast();
  const [status, setStatus] = useState('all');
  const [replying, setReplying] = useState(null);
  const [replyText, setReplyText] = useState('');
  const list = useListQuery((query) => api.feedback.mine({ ...query, status: status === 'all' ? undefined : status }), { limit: 10 });

  const feedbackItems = list.items;

  const handleReply = async (item) => {
    setReplying(item);
    setReplyText('');
  };

  const submitReply = async () => {
    if (!replying || !replyText.trim()) return;
    try {
      await api.feedback.respond(replying._id, { body: replyText.trim() });
      toast.success('Reply sent');
      setReplying(null);
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not send reply');
    }
  };

  return (
    <div>
      <PageHeader
        title="Feedback & support tickets"
        subtitle="Messages you sent to organisers. Track status and continue conversations."
        icon="chat"
        actions={
          <Tabs active={status} onChange={setStatus} tabs={STATUS_TABS} />
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by subject, expo or message…"
        onReset={list.reset}
      />

      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : feedbackItems.length === 0 ? (
        <EmptyState
          icon="chat"
          title="No feedback yet"
          message="Submit feedback from the expo page or session detail to start a conversation with organisers."
        />
      ) : (
        <>
          <div className="space-y-3">
            {feedbackItems.map((item) => (
              <Card key={item._id} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{item.subject}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{item.category} · {item.expo?.title || 'General'}</p>
                      </div>
                      <Badge status={item.status} />
                    </div>

                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{truncate(item.body, 300)}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Submitted {formatDate(item.createdAt)}</p>

                    {item.replies?.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                        {item.replies.map((reply) => (
                          <div key={reply._id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {reply.isStaff ? 'Organiser' : 'You'} · {formatDate(reply.createdAt)}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {item.status === 'open' && (
                      <Button size="sm" variant="secondary" icon="reply" onClick={() => handleReply(item)}>
                        Reply
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" icon="eye" onClick={() => {}}>
                      View
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Pagination meta={list.meta} onPageChange={list.setPage} />
        </>
      )}

      {replying && (
        <ConfirmDialog
          open
          onClose={() => setReplying(null)}
          onConfirm={submitReply}
          title="Reply to organiser"
          confirmLabel="Send reply"
          message={
            <div className="space-y-3">
              <p className="text-sm font-medium">{replying.subject}</p>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Your message…"
                rows={4}
                autoFocus
              />
            </div>
          }
        />
      )}
    </div>
  );
};

export default AttendeeFeedback;