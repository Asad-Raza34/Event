import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatTime, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, ProgressBar, Select } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const AdminSchedule = () => {
  const [params, setParams] = useSearchParams();
  const expoId = params.get('expo') || '';
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true', sort: '-startDate' }), []);
  const schedule = useApi(() => api.expos.schedule(expoId, { limit: 200 }), [expoId], { enabled: Boolean(expoId) });
  const occupancy = useApi(() => api.expos.occupancy(expoId), [expoId], { enabled: Boolean(expoId) });
  const [activeDay, setActiveDay] = useState('');

  useEffect(() => {
    if (!expoId && expos.data?.length) setParams({ expo: expos.data[0]._id }, { replace: true });
  }, [expoId, expos.data, setParams]);

  useEffect(() => {
    if (schedule.data?.length) setActiveDay((current) => current || schedule.data[0].date);
  }, [schedule.data]);

  const activeExpo = (expos.data || []).find((expo) => expo._id === expoId);
  const days = schedule.data || [];
  const daySessions = days.find((day) => day.date === activeDay)?.sessions || [];
  const totalSessions = days.reduce((sum, day) => sum + day.sessions.length, 0);

  return (
    <div>
      <PageHeader
        title="Schedule planner"
        subtitle="Review the full programme day by day, spot clashes and keep the running order tight."
        icon="clock"
        actions={
          <>
            <Select
              className="min-w-[240px]"
              value={expoId}
              placeholder="Select an expo"
              options={(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title }))}
              onChange={(event) => setParams({ expo: event.target.value }, { replace: true })}
              aria-label="Select expo"
            />
            <Link to="/admin/sessions">
              <Button icon="plus">Manage sessions</Button>
            </Link>
          </>
        }
      />

      {!expoId ? (
        <EmptyState icon="calendar" title="Choose an expo" message="Pick an expo to review its day-by-day programme." />
      ) : schedule.loading ? (
        <LoadingState rows={3} />
      ) : schedule.error ? (
        <ErrorState error={schedule.error} onRetry={schedule.reload} />
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Sessions', value: totalSessions, icon: 'mic' },
              { label: 'Programme days', value: days.length, icon: 'calendar' },
              { label: 'Expo dates', value: activeExpo ? `${formatDate(activeExpo.startDate, { month: 'short' })} → ${formatDate(activeExpo.endDate, { month: 'short' })}` : '—', icon: 'clock' },
              {
                label: 'Booth occupancy',
                value: `${(() => {
                  const rows = Array.isArray(occupancy.data) ? occupancy.data : [];
                  const total = rows.reduce((sum, row) => sum + row.total, 0);
                  const taken = rows.reduce((sum, row) => sum + row.occupied, 0);
                  return total ? Math.round((taken / total) * 100) : 0;
                })()}%`,
                icon: 'map',
              },
            ].map((item) => (
              <Card key={item.label} className="card-pad flex items-center gap-3">
                <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="text-lg font-bold">{item.value}</p>
                </div>
              </Card>
            ))}
          </div>

          {days.length === 0 ? (
            <EmptyState
              icon="clock"
              title="No sessions scheduled"
              message="Add sessions to build the programme for this expo."
              action={
                <Link to="/admin/sessions">
                  <Button icon="plus">Schedule a session</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
              <Card className="card-pad self-start lg:sticky lg:top-24">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Programme days</p>
                <div className="mt-3 space-y-1.5">
                  {days.map((day) => {
                    const sessions = day.sessions.length;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setActiveDay(day.date)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                          activeDay === day.date
                            ? 'bg-brand-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>
                          <span className="block font-medium">
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span className={`block text-[11px] ${activeDay === day.date ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                            {sessions} sessions
                          </span>
                        </span>
                        {sessions > 0 && <span className="text-xs font-semibold">{sessions}</span>}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <div className="space-y-3">
                {daySessions.map((session) => (
                  <Card key={session._id} hover className="flex flex-wrap items-start gap-4 p-5">
                    <div className="w-[92px] shrink-0">
                      <p className="text-sm font-semibold">{formatTime(session.startTime)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatTime(session.endTime)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{session.title}</h3>
                        <span className="badge-neutral text-[10px]">{titleCase(session.type)}</span>
                        {session.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <Icon name="location" className="mr-1 inline h-3.5 w-3.5" />
                        {session.location?.room || 'Room TBA'}
                        {session.speakers?.length ? ` · ${session.speakers.map((speaker) => speaker.name).join(', ')}` : ''}
                      </p>
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{truncate(session.description || '', 150)}</p>
                      <div className="mt-3 max-w-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {session.registeredCount || 0}/{session.capacity || '∞'} seats
                          </span>
                          <span>{session.capacity ? `${Math.round(((session.registeredCount || 0) / session.capacity) * 100)}% full` : ''}</span>
                        </div>
                        <ProgressBar className="mt-1" value={session.registeredCount || 0} max={session.capacity || 1} />
                      </div>
                    </div>
                    <Link to={`/sessions/${session._id}`}>
                      <Button size="sm" variant="secondary" icon="eye">
                        Details
                      </Button>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminSchedule;
