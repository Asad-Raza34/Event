import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { EXPO_CATEGORIES } from '../../lib/constants';
import { compactNumber, formatCurrency, formatDate, mediaUrl, timeUntil, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Spinner } from '../../components/ui';
import { EmptyState } from '../../components/ui/data';

const FEATURES = [
  { icon: 'calendar', title: 'Plan expos end to end', text: 'Drafts, publishing, themes, venues, capacity limits and live status automation.' },
  { icon: 'map', title: 'Interactive floor plans', text: 'Publish booths by zone, track occupancy and let exhibitors reserve online.' },
  { icon: 'mic', title: 'Schedules & sessions', text: 'Sessions, workshops, keynotes, speakers, capacity and waitlists.' },
  { icon: 'qr', title: 'QR passes & check-in', text: 'Digital event passes with instant scanning at the door.' },
  { icon: 'credit-card', title: 'Payments & invoices', text: 'Booth bookings and tickets with a swappable gateway layer.' },
  { icon: 'sparkles', title: 'AI event assistant', text: 'Ask about booths, sessions and exhibitors — answered from live data.' },
];

const SectionHeading = ({ eyebrow, title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-400">{eyebrow}</p>}
      <h2 className="mt-1.5 text-2xl font-bold sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const HomePage = () => {
  const { isAuthenticated, homeRoute } = useAuth();
  const expos = useApi(() => api.expos.list({ limit: 6, upcoming: 'true' }), []);
  const exhibitors = useApi(() => api.exhibitors.directory({ limit: 6, sort: '-avgRating' }), []);
  const sessions = useApi(() => api.sessions.list({ limit: 5, when: 'upcoming' }), []);
  const analyticsReady = expos.data || exhibitors.data || sessions.data;

  const stats = [
    { label: 'Live expos', value: expos.meta?.total ?? '—', icon: 'calendar' },
    { label: 'Exhibitors', value: exhibitors.meta?.total ?? '—', icon: 'building' },
    { label: 'Sessions scheduled', value: sessions.meta?.total ?? '—', icon: 'mic' },
    { label: 'Roles supported', value: '3', icon: 'users' },
  ];

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <span className="badge-brand">
              <Icon name="spark" className="h-3.5 w-3.5" /> Expo &amp; event management, all in one platform
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-balance sm:text-5xl">
              Run extraordinary expos — from the first exhibitor application to the last scan at the door.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 dark:text-slate-300">
              EventSphere connects organizers, exhibitors and attendees: booth allocation, schedules, appointments, payments,
              real-time chat, QR check-in and an AI assistant grounded in your event data.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/expos">
                <Button size="lg" icon="compass">
                  Browse expos
                </Button>
              </Link>
              <Link to={isAuthenticated ? homeRoute : '/register'}>
                <Button size="lg" variant="secondary" icon="spark">
                  {isAuthenticated ? 'Go to dashboard' : 'Create free account'}
                </Button>
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800">
                  <Icon name={stat.icon} className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <dd className="mt-2 text-2xl font-bold">{stat.value}</dd>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-5 shadow-pop dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Live platform activity</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Realtime
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {expos.loading && !analyticsReady ? (
                  <div className="flex items-center justify-center py-14 text-slate-400">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  (expos.data || []).slice(0, 4).map((expo) => (
                    <Link
                      key={expo._id}
                      to={`/expos/${expo.slug || expo._id}`}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200/70 p-3 transition hover:border-brand-300 dark:border-slate-800"
                    >
                      {expo.banner ? (
                        <img src={mediaUrl(expo.banner)} alt="" className="h-12 w-16 rounded-xl object-cover" />
                      ) : (
                        <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                          <Icon name="calendar" className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{expo.title}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(expo.startDate)} · {expo.location?.city || 'Venue TBA'}
                        </span>
                      </span>
                      <Badge status={expo.status} dot />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Everything included"
          title="One platform, three experiences"
          subtitle="Organizers get a full control room, exhibitors get a workspace, attendees get a personal event companion."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} hover className="card-pad">
              <span className="inline-flex rounded-2xl bg-brand-50 p-3 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                <Icon name={feature.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{feature.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ expos */}
      <section className="border-y border-slate-200/70 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Upcoming"
            title="Expos open for registration"
            subtitle="Discover what is coming next and reserve your pass in a couple of clicks."
            action={
              <Link to="/expos">
                <Button variant="secondary" icon="chevron-right">
                  All expos
                </Button>
              </Link>
            }
          />

          {expos.loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Spinner size="lg" />
            </div>
          ) : (expos.data || []).length === 0 ? (
            <EmptyState icon="calendar" title="No published expos yet" message="Organizers are preparing the next events — check back shortly." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(expos.data || []).map((expo) => (
                <Card key={expo._id} hover className="flex flex-col overflow-hidden">
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {expo.banner ? (
                      <img src={mediaUrl(expo.banner)} alt={expo.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-slate-400">
                        <Icon name="calendar" className="h-8 w-8" />
                      </span>
                    )}
                    <span className="absolute left-3 top-3">
                      <Badge status={expo.status} dot />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{titleCase(expo.category)}</p>
                    <h3 className="mt-1.5 text-base font-semibold">{expo.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm text-slate-500 dark:text-slate-400">{truncate(expo.description || '', 110)}</p>
                    <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <p className="flex items-center gap-1.5">
                        <Icon name="calendar" className="h-3.5 w-3.5" /> {formatDate(expo.startDate)} – {formatDate(expo.endDate)}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Icon name="location" className="h-3.5 w-3.5" /> {expo.location?.venue || 'Venue TBA'}
                        {expo.location?.city ? `, ${expo.location.city}` : ''}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {expo.ticketPrice > 0 ? formatCurrency(expo.ticketPrice, expo.currency) : 'Free entry'}
                      </span>
                      <Link to={`/expos/${expo.slug || expo._id}`}>
                        <Button size="sm" icon="chevron-right">
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------- exhibitors */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Directory"
          title="Exhibitors showcasing at EventSphere"
          subtitle="Browse company profiles, products and booth locations before you arrive."
          action={
            <Link to="/exhibitors">
              <Button variant="secondary" icon="chevron-right">
                Full directory
              </Button>
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(exhibitors.data || []).slice(0, 6).map((exhibitor) => (
            <Card key={exhibitor._id} hover className="card-pad flex items-start gap-4">
              {exhibitor.logo ? (
                <img src={mediaUrl(exhibitor.logo)} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <Icon name="building" className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{exhibitor.companyName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {exhibitor.categories?.slice(0, 2).map(titleCase).join(' · ') || 'Exhibitor'}
                </p>
                <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{truncate(exhibitor.description || '', 90)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ★ {Number(exhibitor.avgRating || 0).toFixed(1)} ({exhibitor.reviewCount || 0})
                  </span>
                  <Link className="link text-xs" to={`/exhibitors/${exhibitor.slug || exhibitor._id}`}>
                    View profile
                  </Link>
                </div>
              </div>
            </Card>
          ))}
          {!exhibitors.loading && (exhibitors.data || []).length === 0 && (
            <EmptyState icon="building" title="No exhibitors published yet" className="sm:col-span-2 lg:col-span-3" />
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- sessions */}
      <section className="border-t border-slate-200/70 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Programme"
            title="Next sessions on the agenda"
            subtitle="Keynotes, workshops and panels — register, bookmark and get reminders."
            action={
              <Link to="/schedule">
                <Button variant="secondary" icon="chevron-right">
                  Full schedule
                </Button>
              </Link>
            }
          />
          <div className="space-y-3">
            {(sessions.data || []).map((session) => (
              <Card key={session._id} hover className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <span className="text-[10px] font-semibold uppercase">{formatDate(session.date, { month: 'short' })}</span>
                  <span className="text-lg font-bold leading-none">{new Date(session.date).getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{session.title}</h3>
                    <span className="badge-neutral text-[10px]">{titleCase(session.type)}</span>
                    {session.capacity ? (
                      <span className="badge-info text-[10px]">
                        {Math.max(0, session.capacity - (session.registeredCount || 0))} seats left
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {session.startTime}–{session.endTime} · {session.location?.room || session.expo?.title}
                    {session.speakers?.length ? ` · ${session.speakers.map((speaker) => speaker.name).join(', ')}` : ''}
                  </p>
                </div>
                <Link to={`/sessions/${session._id}`}>
                  <Button size="sm" variant="secondary" icon="chevron-right">
                    Session
                  </Button>
                </Link>
              </Card>
            ))}
            {!sessions.loading && (sessions.data || []).length === 0 && (
              <EmptyState icon="mic" title="No sessions scheduled yet" message="The programme will appear here once organizers publish sessions." />
            )}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl gradient-brand px-8 py-12 text-white sm:px-14">
          <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-3xl font-bold">Ready to run your next expo on EventSphere?</h2>
              <p className="mt-3 max-w-2xl text-sm text-white/85">
                Create an organizer account to publish expos, review exhibitor applications, allocate booths and watch the
                analytics roll in. Attendees and exhibitors can join instantly with their own dashboards.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={isAuthenticated ? homeRoute : '/register'}>
                  <Button size="lg" variant="secondary">
                    {isAuthenticated ? 'Open dashboard' : 'Get started free'}
                  </Button>
                </Link>
                <Link to="/schedule">
                  <Button size="lg" variant="ghost" className="text-white hover:bg-white/10">
                    See the programme
                  </Button>
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-white/90">
              {[
                { label: 'Categories', value: compactNumber(EXPO_CATEGORIES.length), icon: 'compass' },
                { label: 'Realtime channels', value: '10+', icon: 'chat' },
                { label: 'Check-in modes', value: 'QR + manual', icon: 'qr' },
                { label: 'Roles', value: 'Admin · Exhibitor · Attendee', icon: 'users2' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/10 p-4">
                  <Icon name={item.icon} className="h-5 w-5" />
                  <dd className="mt-2 text-sm font-semibold">{item.value}</dd>
                  <dt className="text-[11px] uppercase tracking-wide text-white/70">{item.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
