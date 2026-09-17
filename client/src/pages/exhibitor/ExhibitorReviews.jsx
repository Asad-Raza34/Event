import { useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatDate, initials, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Field, Modal, ProgressBar, StarRating, StatCard, Tabs, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const ExhibitorReviews = () => {
  const toast = useToast();
  const workspace = useApi(() => api.exhibitors.workspace(), []);
  const profileId = workspace.data?.profile?._id;
  const list = useListQuery((query) => api.reviews.list({ ...query, target: profileId, targetType: 'exhibitor' }), { limit: 10 }, [profileId]);
  const [tab, setTab] = useState('all');
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);

  const reviews = list.items;
  const profile = workspace.data?.profile;
  const rating = profile?.avgRating || 0;

  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => review.rating === star).length,
  }));
  const totalReviews = reviews.length || 1;

  const submitReply = async () => {
    setBusy(true);
    try {
      await api.reviews.reply(replyTarget._id, replyBody);
      toast.success('Reply published');
      setReplyTarget(null);
      setReplyBody('');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'The reply could not be posted');
    } finally {
      setBusy(false);
    }
  };

  const filtered = tab === 'replied' ? reviews.filter((review) => review.replies?.length) : tab === 'pending' ? reviews.filter((review) => !review.replies?.length) : reviews;

  return (
    <div>
      <PageHeader
        title="Reviews & ratings"
        subtitle="What attendees say about your company — reply publicly to build trust."
        icon="star"
        actions={
          <Button variant="secondary" icon="refresh" onClick={list.reload}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average rating" value={Number(rating).toFixed(1)} hint={`${profile?.reviewCount || 0} reviews`} icon="star" tone="warning" />
        <StatCard label="Reviewed this month" value={reviews.length} hint="On the current page" icon="message" tone="info" />
        <StatCard label="Awaiting a reply" value={reviews.filter((review) => !review.replies?.length).length} icon="chat" tone="brand" />
        <StatCard label="Profile views" value={profile?.profileViews || 0} icon="eye" tone="success" />
      </div>

      <div className="mt-5 mb-4">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All reviews', icon: 'star', count: reviews.length },
            { value: 'pending', label: 'Awaiting reply', icon: 'chat', count: reviews.filter((review) => !review.replies?.length).length },
            { value: 'replied', label: 'Replied', icon: 'check', count: reviews.filter((review) => review.replies?.length).length },
          ]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <FilterBar
            search={list.search}
            onSearch={list.setSearch}
            searchPlaceholder="Search reviews…"
            onReset={list.reset}
            filters={[
              {
                name: 'minRating',
                label: 'Rating',
                value: list.filters.minRating || '',
                options: [
                  { value: '5', label: '5 stars' },
                  { value: '4', label: '4 stars and up' },
                  { value: '3', label: '3 stars and up' },
                ],
                onChange: (value) => list.setFilter('minRating', value),
              },
            ]}
          />

          <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<TableSkeleton rows={4} columns={2} />}>
            {filtered.length === 0 ? (
              <EmptyState
                icon="star"
                title={tab === 'pending' ? 'Every review has a reply' : 'No reviews yet'}
                message="Attendees can review your company from your public profile and after visiting your booth."
              />
            ) : (
              <div className="space-y-4">
                {filtered.map((review) => (
                  <Card key={review._id} className="card-pad">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          {initials(review.author?.name || 'Guest')}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{review.author?.name || 'EventSphere attendee'}</p>
                          <div className="flex items-center gap-2">
                            <StarRating value={review.rating} size="sm" showValue={false} />
                            <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(review.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.expo?.title && <Badge tone="info">{review.expo.title}</Badge>}
                        <Badge status={review.status} />
                      </div>
                    </div>

                    {review.title && <p className="mt-3 text-sm font-semibold">{review.title}</p>}
                    {review.comment && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>}

                    {review.replies?.length > 0 ? (
                      <div className="mt-4 space-y-2 border-l-2 border-brand-200 pl-3 dark:border-brand-800">
                        {review.replies.map((reply) => (
                          <div key={reply._id}>
                            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                              {reply.author?.name || 'Your team'} · {formatDate(reply.createdAt)}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon="chat"
                          onClick={() => {
                            setReplyTarget(review);
                            setReplyBody('');
                          }}
                        >
                          Reply publicly
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
                <Pagination meta={list.meta} onPageChange={list.setPage} />
              </div>
            )}
          </DataState>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title="Rating breakdown" subtitle="Based on loaded reviews" icon="chart" />
            <div className="card-pad space-y-3">
              {breakdown.map((item) => (
                <div key={item.star}>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.star} star</span>
                    <span>{item.count}</span>
                  </div>
                  <ProgressBar className="mt-1" value={item.count} max={totalReviews} tone="warning" />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Replying well" icon="sparkles" />
            <div className="card-pad space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Thank the attendee and reference something specific from their review.
              </p>
              <p className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Offer a concrete next step — a demo, a catalogue, or a follow-up meeting.
              </p>
              <p className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Keep it short; replies appear publicly on your profile.
              </p>
            </div>
          </Card>
        </aside>
      </div>

      <Modal
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        title="Reply to this review"
        subtitle={replyTarget ? `${replyTarget.author?.name || 'Attendee'} rated you ${replyTarget.rating}/5` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplyTarget(null)}>
              Cancel
            </Button>
            <Button icon="send" loading={busy} disabled={!replyBody.trim()} onClick={submitReply}>
              Publish reply
            </Button>
          </>
        }
      >
        {replyTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <StarRating value={replyTarget.rating} size="sm" />
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{replyTarget.comment || 'No written review.'}</p>
            </div>
            <Field label="Your reply" required>
              <Textarea rows={4} value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="Thanks for visiting us — glad the demo was useful. We will email the spec sheet today." />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExhibitorReviews;
