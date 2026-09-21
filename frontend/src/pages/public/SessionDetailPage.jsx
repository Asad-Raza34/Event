import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLES } from '../../lib/constants';
import { formatDate, formatTime, initials, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, ProgressBar, StarRating, Textarea } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const SessionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated, role } = useAuth();
  const detail = useApi(() => api.sessions.detail(id), [id]);
  const reviews = useApi(() => api.sessions.reviews(id, { limit: 10 }), [id]);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);

  const session = detail.data?.session;
  const stats = detail.data?.stats || {};
  const registration = detail.data?.myRegistration;

  const register = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/sessions/${id}` } });
      return;
    }
    setBusy(true);
    try {
      const response = await api.sessions.register(id);
      toast.success(response.data?.waitlisted ? 'You joined the waitlist' : 'Registered — see you there!');
      detail.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not register');
    } finally {
      setBusy(false);
    }
  };

  const unregister = async () => {
    setBusy(true);
    try {
      await api.sessions.unregister(id);
      toast.success('Registration removed');
      detail.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not cancel your registration');
    } finally {
      setBusy(false);
    }
  };

  const bookmark = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/sessions/${id}` } });
      return;
    }
    try {
      const next = !registration?.bookmarked;
      await api.sessions.bookmark(id, next);
      toast.success(next ? 'Bookmarked' : 'Bookmark removed');
      detail.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not update the bookmark');
    }
  };

  const submitReview = async () => {
    setBusy(true);
    try {
      await api.reviews.create({ targetType: 'session', targetId: id, rating, comment });
      toast.success('Thanks for rating this session');
      setComment('');
      reviews.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not save your review');
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading) return <LoadingState rows={3} className="mx-auto max-w-4xl px-4 py-12" />;
  if (detail.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumbs={[
          { label: 'Schedule', to: '/schedule' },
          ...(session.expo ? [{ label: session.expo.title, to: `/expos/${session.expo.slug || session.expo._id}` }] : []),
          { label: session.title },
        ]}
        title={session.title}
        subtitle={`${formatDate(session.date)} · ${formatTime(session.startTime)}–${formatTime(session.endTime)} · ${session.location?.room || 'Room TBA'}`}
        actions={
          <>
            <Button variant="secondary" icon="bookmark" onClick={bookmark}>
              {registration?.bookmarked ? 'Bookmarked' : 'Bookmark'}
            </Button>
            {registration?.registered ? (
              <Button variant="danger" icon="x" loading={busy} onClick={unregister}>
                Cancel registration
              </Button>
            ) : (
              <Button icon="plus" loading={busy} disabled={session.status === 'cancelled'} onClick={register}>
                Register
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card className="card-pad">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={session.status} dot />
              <span className="badge-neutral">{titleCase(session.type)}</span>
              {session.level && <span className="badge-info">{titleCase(session.level)}</span>}
              {session.isFeatured && <Badge tone="warning">Featured</Badge>}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
              {session.description || 'The organizers have not added a description for this session yet.'}
            </p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Date', value: formatDate(session.date, { weekday: 'long' }) },
                { label: 'Time', value: `${formatTime(session.startTime)} – ${formatTime(session.endTime)}` },
                { label: 'Room', value: session.location?.room || 'To be announced' },
                {
                  label: 'Booth location',
                  value: session.location?.booth ? `${session.location.booth.zone}-${session.location.booth.number}` : '—',
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</dt>
                  <dd className="mt-0.5 text-sm">{item.value}</dd>
                </div>
              ))}
            </dl>

            {session.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {session.tags.map((tag) => (
                  <span key={tag} className="badge-neutral text-[11px]">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {session.status === 'cancelled' && session.cancelReason && (
              <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
                Cancelled: {session.cancelReason}
              </p>
            )}
          </Card>

          {session.speakers?.length > 0 && (
            <Card className="card-pad">
              <h2 className="text-base font-semibold">Speakers</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {session.speakers.map((speaker) => (
                  <li key={speaker._id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    {speaker.photo ? (
                      <img src={mediaUrl(speaker.photo)} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {initials(speaker.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{speaker.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {[speaker.title, speaker.organization].filter(Boolean).join(' · ')}
                      </p>
                      {speaker.bio && <p className="mt-1 line-clamp-3 text-xs text-slate-500 dark:text-slate-400">{speaker.bio}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="card-pad">
            <h2 className="text-base font-semibold">Ratings &amp; reviews</h2>
            {isAuthenticated && role === ROLES.ATTENDEE && (
              <div className="mt-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <StarRating value={rating} onChange={setRating} size="lg" showValue={false} />
                  <span className="text-sm text-slate-500 dark:text-slate-400">{rating} of 5</span>
                </div>
                <Textarea className="mt-3" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="How was the session?" />
                <div className="mt-3 flex justify-end">
                  <Button icon="star" loading={busy} disabled={!comment.trim()} onClick={submitReview}>
                    Submit review
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {(reviews.data || []).length === 0 ? (
                <EmptyState icon="star" title="No reviews yet" message="Attendees can rate this session after it takes place." className="border-0 py-6" />
              ) : (
                (reviews.data || []).map((review) => (
                  <div key={review._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{review.author?.name || 'Attendee'}</p>
                      <StarRating value={review.rating} size="sm" showValue={false} />
                    </div>
                    {review.comment && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>}
                    <p className="mt-1 text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="card-pad">
            <h2 className="text-sm font-semibold">Seats</h2>
            <p className="mt-2 text-2xl font-bold">
              {Math.max(0, (session.capacity || 0) - (stats.registered || 0))}
              <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">of {session.capacity || '∞'} left</span>
            </p>
            <ProgressBar className="mt-3" value={stats.registered || 0} max={session.capacity || 1} tone={stats.fillRate > 85 ? 'warning' : 'brand'} />
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Registered</span>
                <span className="font-medium">{stats.registered || 0}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Bookmarked</span>
                <span className="font-medium">{stats.bookmarks || 0}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Your status</span>
                <span className="font-medium">{registration?.registered ? titleCase(registration.status) : 'Not registered'}</span>
              </li>
            </ul>
          </Card>

          {session.expo && (
            <Card className="card-pad">
              <h2 className="text-sm font-semibold">Part of</h2>
              <p className="mt-2 text-sm">{session.expo.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(session.expo.startDate)} – {formatDate(session.expo.endDate)}
              </p>
              <Link to={`/expos/${session.expo.slug || session.expo._id}`} className="mt-3 block">
                <Button variant="secondary" className="w-full" icon="calendar">
                  View expo
                </Button>
              </Link>
            </Card>
          )}

          <Card className="card-pad">
            <h2 className="text-sm font-semibold">Reminder</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Registered attendees receive a reminder notification 30 minutes before the session starts.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Icon name="bell" className="h-3.5 w-3.5" /> Session reminders are automatic
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default SessionDetailPage;
