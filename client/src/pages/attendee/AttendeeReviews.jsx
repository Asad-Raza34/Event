import { useMemo, useState } from 'react';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { formatDate, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, StarRating, Tabs } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const TYPE_TABS = [
  { value: 'all', label: 'All reviews', icon: 'star' },
  { value: 'exhibitor', label: 'Exhibitors', icon: 'building' },
  { value: 'session', label: 'Sessions', icon: 'mic' },
];

const AttendeeReviews = () => {
  const toast = useToast();
  const [type, setType] = useState('all');
  const list = useListQuery((query) => api.reviews.mine({ ...query, targetType: type === 'all' ? undefined : type }), { limit: 10 });

  const reviews = list.items;

  const handleUpdate = async (review, rating, comment) => {
    try {
      await api.reviews.update(review._id, { rating, comment });
      toast.success('Review updated');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not update review');
    }
  };

  const handleDelete = async (review) => {
    try {
      await api.reviews.remove(review._id);
      toast.success('Review deleted');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not delete review');
    }
  };

  return (
    <div>
      <PageHeader
        title="My reviews"
        subtitle="Feedback you have shared about exhibitors and sessions. Edit or remove them anytime."
        icon="star"
        actions={
          <Tabs active={type} onChange={setType} tabs={TYPE_TABS} />
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by exhibitor, session or comment…"
        onReset={list.reset}
      />

      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon="star"
          title="No reviews yet"
          message="Your reviews will appear here after you submit them from the exhibitor profile or session detail page."
          action={
            <a href="/expos">
              <Button icon="compass">Browse expos</Button>
            </a>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review._id} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  {(review.target?.logo || review.target?.avatar) ? (
                    <img src={review.target?.logo || review.target?.avatar} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                      <Icon name={review.targetType === 'exhibitor' ? 'building' : 'mic'} className="h-6 w-6" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{review.target?.companyName || review.target?.title || 'Item removed'}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{review.targetType} review</p>
                      </div>
                      <Badge tone={review.status === 'published' ? 'success' : 'warning'}>{titleCase(review.status)}</Badge>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <StarRating value={review.rating} showValue={false} size="sm" />
                      <span className="text-sm text-slate-500 dark:text-slate-400">{formatDate(review.createdAt)}</span>
                      {review.expo?.title && (
                        <span className="badge-neutral text-xs">{review.expo.title}</span>
                      )}
                    </div>

                    {review.comment && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{truncate(review.comment, 200)}</p>}

                    {review.reply && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Organiser reply</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{truncate(reply.body, 200)}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(review.reply.createdAt)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button size="sm" variant="secondary" icon="pencil" onClick={() => {}}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => handleDelete(review)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Pagination meta={list.meta} onPageChange={list.setPage} />
        </>
      )}
    </div>
  );
};

export default AttendeeReviews;