import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { formatDate, formatTime, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, ProgressBar, StatCard } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const AttendeeBookmarks = () => {
  const toast = useToast();
  const [busyId, setBusyId] = useState('');
  const agenda = useApi(() => api.sessions.agenda({ kind: 'bookmarks', limit: 100 }), []);

  const entries = useMemo(() => (agenda.data || []).filter((entry) => entry.session && entry.bookmarked), [agenda.data]);

  const byDay = useMemo(() => {
    const map = new Map();
    entries
      .slice()
      .sort((a, b) => new Date(a.session.date) - new Date(b.session.date) || String(a.session.startTime).localeCompare(String(b.session.startTime)))
      .forEach((entry) => {
        const key = new Date(entry.session.date).toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(entry);
      });
    return Array.from(map.entries());
  }, [entries]);

  const totalBookmarks = entries.length;
  const upcomingBookmarks = entries.filter(
    (entry) => entry.session && new Date(entry.session.date) >= new Date(new Date().toDateString()),
  ).length;

  const toggleBookmark = async (entry) => {
    setBusyId(entry._id);
    try {
      await api.sessions.bookmark(entry.session._id, !entry.bookmarked);
      toast.success(entry.bookmarked ? 'Bookmark removed' : 'Session bookmarked');
      agenda.reload();
    } catch (error) {
      toast.error(error?.message || 'That change could not be saved');
    } finally {
      setBusyId('');
    }
  };

  const toggleRegistration = async (entry) => {
    setBusyId(entry._id);
    try {
      if (entry.registered && entry.status !== 'cancelled') {
        await api.sessions.unregister(entry.session._id);
        toast.success('Removed from your agenda');
      } else {
        await api.sessions.register(entry.session._id);
        toast.success('Session added to your agenda');
      }
      agenda.reload();
    } catch (error) {
      toast.error(error?.message || 'That change could not be saved');
    } finally {
      setBusyId('');
    }
  };

  if (agenda.loading && !agenda.data) return <LoadingState rows={3} />;
  if (agenda.error) {
    return (
      <div>
        <PageHeader title="My bookmarks" />
        <ErrorState error={agenda.error} onRetry={agenda.reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My bookmarks"
        subtitle="Sessions you saved for later. Register to secure your seat or unbookmark to declutter."
        icon="bookmark"
        actions={
          <Link to="/schedule">
            <Button icon="compass">Browse the programme</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total bookmarks" value={totalBookmarks} hint="Saved sessions" icon="bookmark" />
        <StatCard label="Upcoming" value={upcomingBookmarks} hint="Still to attend" icon="clock" tone="warning" />
        <StatCard label="Registered" value={entries.filter((e) => e.registered && e.status !== 'cancelled').length} hint="Confirmed seats" icon="check" tone="success" />
        <StatCard label="Days covered" value={byDay.length} hint="Distinct event days" icon="calendar" tone="info" />
      </div>

      {entries.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon="bookmark"
            title="No bookmarked sessions"
            message="Browse the event programme and click the bookmark icon on sessions you want to revisit."
            action={
              <Link to="/schedule">
                <Button icon="compass">Browse the programme</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {byDay.map(([day, dayEntries]) => (
            <section key={day}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <span className="text-[10px] font-semibold uppercase">{formatDate(day, { month: 'short' })}</span>
                  <span className="text-sm font-bold leading-none">{new Date(day).getDate()}</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold">
                    {new Date(day).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{dayEntries.length} bookmarked session{dayEntries.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="space-y-3">
                {dayEntries.map((entry) => {
                  const session = entry.session;
                  const seatsLeft = Math.max(0, (session.capacity || 0) - (session.registeredCount || 0));
                  return (
                    <Card key={entry._id} className="p-5">
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="w-[92px] shrink-0">
                          <p className="text-sm font-semibold">{formatTime(session.startTime)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatTime(session.endTime)}</p>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">{session.title}</h3>
                            <span className="badge-neutral text-[10px]">{titleCase(session.type)}</span>
                            {entry.registered && entry.status !== 'cancelled' && <Badge tone="success">Registered</Badge>}
                            <Badge tone="info">Bookmarked</Badge>
                            {entry.status === 'attended' && <Badge tone="brand">Attended</Badge>}
                            {session.status === 'cancelled' && <Badge tone="danger">Session cancelled</Badge>}
                          </div>

                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <Icon name="location" className="mr-1 inline h-3.5 w-3.5" />
                            {session.location?.room || 'Room TBA'}
                            {session.expo?.title ? ` · ${session.expo.title}` : ''}
                          </p>

                          {session.description && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{truncate(session.description, 150)}</p>}

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
                                <span>{seatsLeft <= 0 ? 'Waitlist only' : `${seatsLeft} seats left`}</span>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="x"
                            loading={busyId === entry._id}
                            onClick={() => toggleBookmark(entry)}
                          >
                            Unbookmark
                          </Button>
                          {entry.registered && entry.status !== 'cancelled' ? (
                            <Button size="sm" variant="secondary" icon="x" loading={busyId === entry._id} onClick={() => toggleRegistration(entry)}>
                              Remove
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              icon="plus"
                              loading={busyId === entry._id}
                              disabled={session.status === 'cancelled'}
                              onClick={() => toggleRegistration(entry)}
                            >
                              Register
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttendeeBookmarks;