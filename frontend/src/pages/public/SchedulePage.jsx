import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SESSION_TYPES } from '../../lib/constants';
import { formatDate, formatTime, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, ProgressBar, Select } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const SchedulePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const list = useListQuery((query) => api.sessions.list(query), {
    limit: 25,
    initialFilters: { when: 'upcoming' },
  });

  const byDay = useMemo(() => {
    const map = new Map();
    list.items.forEach((session) => {
      const key = new Date(session.date).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [list.items]);

  const register = async (session) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/schedule' } });
      return;
    }
    try {
      const response = await api.sessions.register(session._id);
      toast.success(response.data?.waitlisted ? 'Added to the waitlist' : 'Session registered');
      list.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not register for that session');
    }
  };

  const bookmark = async (session) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/schedule' } });
      return;
    }
    try {
      await api.sessions.bookmark(session._id, true);
      toast.success('Bookmarked — find it under your bookmarks');
    } catch (error) {
      toast.error(error?.message || 'Could not bookmark that session');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Event programme"
        subtitle="Every keynote, workshop, seminar and panel across all expos. Register or bookmark sessions to build your agenda."
        icon="clock"
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search sessions, speakers, rooms or tags…"
        onReset={list.reset}
        filters={[
          {
            name: 'when',
            label: 'When',
            value: list.filters.when || '',
            placeholder: 'Any time',
            options: [
              { value: 'today', label: 'Today' },
              { value: 'tomorrow', label: 'Tomorrow' },
              { value: 'upcoming', label: 'Upcoming' },
            ],
            onChange: (value) => list.setFilter('when', value),
          },
          {
            name: 'type',
            label: 'Type',
            value: list.filters.type || '',
            options: SESSION_TYPES.map((type) => ({ value: type, label: titleCase(type) })),
            onChange: (value) => list.setFilter('type', value),
          },
        ]}
        right={
          <div className="w-[180px]">
            <label className="label" htmlFor="session-availability">
              Availability
            </label>
            <Select
              id="session-availability"
              value={list.filters.availableOnly || ''}
              placeholder="All sessions"
              options={[{ value: 'true', label: 'Seats available' }]}
              onChange={(event) => list.setFilter('availableOnly', event.target.value)}
            />
          </div>
        }
      />

      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyState icon="clock" title="No sessions found" message="Try a different day, type or search term." />
      ) : (
        <>
          <div className="space-y-6">
            {byDay.map(([day, sessions]) => (
              <section key={day}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-brand-600 text-white">
                    <span className="text-[10px] font-semibold uppercase">{formatDate(day, { month: 'short' })}</span>
                    <span className="text-lg font-bold leading-none">{new Date(day).getDate()}</span>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">
                      {new Date(day).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{sessions.length} sessions</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {sessions.map((session) => {
                    const seatsLeft = Math.max(0, (session.capacity || 0) - (session.registeredCount || 0));
                    return (
                      <Card key={session._id} hover className="p-5">
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="w-[92px] shrink-0">
                            <p className="text-sm font-semibold">{formatTime(session.startTime)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatTime(session.endTime)}</p>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold">{session.title}</h3>
                              <span className="badge-neutral text-[10px]">{titleCase(session.type)}</span>
                              {session.level && <span className="badge-info text-[10px]">{titleCase(session.level)}</span>}
                              {session.isFeatured && <Badge tone="warning">Keynote</Badge>}
                              {session.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              <Icon name="location" className="mr-1 inline h-3.5 w-3.5" />
                              {session.location?.room || 'Room TBA'}
                              {session.expo?.title ? ` · ${session.expo.title}` : ''}
                            </p>
                            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{truncate(session.description || '', 170)}</p>

                            {session.speakers?.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {session.speakers.map((speaker) => (
                                  <span key={speaker._id} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold dark:bg-slate-800">
                                      {speaker.name?.slice(0, 1)}
                                    </span>
                                    {speaker.name} · {speaker.title || speaker.organization || 'Speaker'}
                                  </span>
                                ))}
                              </div>
                            )}

                            {session.capacity > 0 && (
                              <div className="mt-3 max-w-xs">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>{seatsRemainingLabel(seatsLeft)}</span>
                                  <span>
                                    {session.registeredCount || 0}/{session.capacity}
                                  </span>
                                </div>
                                <ProgressBar
                                  className="mt-1"
                                  value={session.registeredCount || 0}
                                  max={session.capacity}
                                  tone={seatsLeft === 0 ? 'danger' : seatsLeft < 10 ? 'warning' : 'brand'}
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <Link to={`/sessions/${session._id}`}>
                              <Button size="sm" variant="secondary" icon="eye">
                                Details
                              </Button>
                            </Link>
                            <Button size="sm" variant="ghost" icon="bookmark" onClick={() => bookmark(session)}>
                              Bookmark
                            </Button>
                            <Button size="sm" icon="plus" disabled={session.status === 'cancelled'} onClick={() => register(session)}>
                              Register
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        </>
      )}
    </div>
  );
};

/** Small helper kept local: seat wording is used in exactly one place. */
function seatsRemainingLabel(seatsLeft) {
  if (seatsLeft <= 0) return 'Waitlist only';
  return `${seatsLeft} seats left`;
}

export default SchedulePage;
