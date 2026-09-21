import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLES } from '../../lib/constants';
import { formatCurrency, formatDate, formatTime, groupByDate, mediaUrl, relativeTime, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Input, Modal, ProgressBar, Select, Tabs, Textarea } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FloorPlanViewer from '../../features/floorplan/FloorPlanViewer';

const EXPO_TABS = [
  { value: 'overview', label: 'Overview', icon: 'info' },
  { value: 'schedule', label: 'Programme', icon: 'clock' },
  { value: 'floorplan', label: 'Floor plan', icon: 'map' },
  { value: 'exhibitors', label: 'Exhibitors', icon: 'building' },
];

const ExpoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated, role, user } = useAuth();
  const detail = useApi(() => api.expos.detail(id), [id]);
  const layout = useApi(() => api.expos.floorPlan(id), [id]);
  const announcements = useApi(() => api.expos.announcements(id, { limit: 5 }), [id]);
  const [tab, setTab] = useState('overview');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    organization: user?.organization || '',
    jobTitle: user?.jobTitle || '',
    country: user?.country || '',
    passType: 'standard',
    dietaryRequirements: '',
    accessibilityNeeds: '',
  });

  const expo = detail.data?.expo;
  const sessions = detail.data?.sessions || [];
  const stats = detail.data?.stats || {};
  const myRegistration = detail.data?.myRegistration;
  const booths = layout.data?.booths || [];

  const exhibitorList = useMemo(() => {
    const map = new Map();
    booths.forEach((booth) => {
      if (booth.exhibitor && !map.has(booth.exhibitor._id)) {
        map.set(booth.exhibitor._id, { exhibitor: booth.exhibitor, booth });
      }
    });
    return Array.from(map.values());
  }, [booths]);

  const schedule = useMemo(() => groupByDate(sessions.map((session) => ({ ...session, date: session.date })), 'date'), [sessions]);

  const register = async () => {
    setSubmitting(true);
    try {
      const response = await api.expos.register(expo._id, form);
      toast.success(response.message || 'Registration confirmed');
      setRegisterOpen(false);
      detail.reload();
      if (response.data?.status === 'pending') {
        navigate('/attendee/payments');
      } else {
        navigate('/attendee/pass');
      }
    } catch (error) {
      toast.error(error?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const bookSession = async (session) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/expos/${id}` } });
      return;
    }
    try {
      const response = await api.sessions.register(session._id);
      toast.success(response.data?.waitlisted ? 'You are on the waitlist' : 'Session added to your agenda');
      detail.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not register for that session');
    }
  };

  if (detail.loading) return <LoadingState rows={4} className="mx-auto max-w-6xl px-4 py-10" />;
  if (detail.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }

  const registrationOpen = expo.status !== 'cancelled' && expo.status !== 'completed' && (!expo.registrationDeadline || new Date(expo.registrationDeadline) > new Date());
  const seatsTaken = stats.registeredCount || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Expos', to: '/expos' }, { label: expo.title }]}
        title={expo.title}
        subtitle={truncate(expo.description || '', 180)}
        actions={
          myRegistration && myRegistration.status !== 'cancelled' ? (
            <Link to={role === ROLES.ATTENDEE ? '/attendee/pass' : '/expos'}>
              <Button icon="qr">View my pass</Button>
            </Link>
          ) : (
            <Button
              icon="ticket"
              disabled={!registrationOpen}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login', { state: { from: `/expos/${id}` } });
                  return;
                }
                setRegisterOpen(true);
              }}
            >
              {registrationOpen ? 'Register for this expo' : 'Registration closed'}
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="relative h-52 w-full bg-slate-100 sm:h-64 dark:bg-slate-800">
          {expo.banner ? (
            <img src={mediaUrl(expo.banner)} alt={expo.title} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-slate-400">
              <Icon name="calendar" className="h-10 w-10" />
            </span>
          )}
          <span className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge status={expo.status} dot />
            {expo.theme && <Badge tone="brand">{expo.theme}</Badge>}
            {expo.isFeatured && <Badge tone="info">Featured</Badge>}
          </span>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Dates', value: `${formatDate(expo.startDate)} – ${formatDate(expo.endDate)}`, icon: 'calendar' },
            { label: 'Venue', value: [expo.location?.venue, expo.location?.city, expo.location?.country].filter(Boolean).join(', ') || 'To be announced', icon: 'location' },
            { label: 'Ticket', value: expo.ticketPrice > 0 ? formatCurrency(expo.ticketPrice, expo.currency) : 'Free entry', icon: 'ticket' },
            { label: 'Registration deadline', value: expo.registrationDeadline ? formatDate(expo.registrationDeadline) : 'Open until full', icon: 'clock' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="text-sm">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 border-t border-slate-100 px-5 py-4 sm:grid-cols-4 dark:border-slate-800">
          {[
            { label: 'Attendees', value: stats.registeredCount || 0 },
            { label: 'Exhibitors', value: stats.exhibitors || exhibitorList.length },
            { label: 'Sessions', value: stats.sessions || sessions.length },
            { label: 'Booths', value: stats.booths || layout.data?.summary?.total || 0 },
          ].map((item) => (
            <div key={item.label}>
              <p className="stat-label">{item.label}</p>
              <p className="mt-0.5 text-xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>

        {expo.maxAttendees > 0 && (
          <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Capacity</span>
              <span>
                {seatsTaken} / {expo.maxAttendees} seats reserved
              </span>
            </div>
            <ProgressBar className="mt-2" value={seatsTaken} max={expo.maxAttendees} tone={seatsTaken / expo.maxAttendees > 0.85 ? 'warning' : 'brand'} />
          </div>
        )}
      </Card>

      <div className="mt-6">
        <Tabs active={tab} onChange={setTab} tabs={EXPO_TABS} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {tab === 'overview' && (
            <>
              <Card className="card-pad">
                <h2 className="text-base font-semibold">About this expo</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{expo.description}</p>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[
                    { label: 'Category', value: titleCase(expo.category) },
                    { label: 'Theme', value: expo.theme || '—' },
                    { label: 'Organizer', value: expo.organizer?.name || 'EventSphere team' },
                    { label: 'Address', value: expo.location?.address || '—' },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</dt>
                      <dd className="mt-0.5 text-sm">{item.value}</dd>
                    </div>
                  ))}
                </dl>

                {expo.tags?.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {expo.tags.map((tag) => (
                      <span key={tag} className="badge-neutral text-[11px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="card-pad">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Icon name="megaphone" className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Announcements
                </h2>
                {(announcements.data || []).length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No announcements have been published for this expo yet.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {announcements.data.map((announcement) => (
                      <li key={announcement._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{announcement.title}</p>
                          {announcement.pinned && <Badge tone="info">Pinned</Badge>}
                          {announcement.priority !== 'normal' && <Badge tone="warning">{titleCase(announcement.priority)}</Badge>}
                          <span className="text-xs text-slate-400">{relativeTime(announcement.publishedAt || announcement.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{announcement.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}

          {tab === 'schedule' && (
            <>
              {sessions.length === 0 ? (
                <EmptyState icon="clock" title="The programme is being finalised" message="Sessions will appear here as soon as organizers publish them." />
              ) : (
                Object.entries(schedule).map(([day, daySessions]) => (
                  <Card key={day}>
                    <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                      <p className="text-sm font-semibold">
                        {new Date(day).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{daySessions.length} sessions</p>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {daySessions.map((session) => (
                        <li key={session._id} className="flex flex-wrap items-start gap-4 p-5">
                          <div className="w-[86px] shrink-0">
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
                              {session.location?.room || 'Room TBA'}
                              {session.speakers?.length ? ` · ${session.speakers.map((speaker) => speaker.name).join(', ')}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{truncate(session.description || '', 140)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link to={`/sessions/${session._id}`}>
                              <Button size="xs" variant="ghost">
                                Details
                              </Button>
                            </Link>
                            <Button size="xs" icon="plus" disabled={session.status === 'cancelled'} onClick={() => bookSession(session)}>
                              Register
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))
              )}
            </>
          )}

          {tab === 'floorplan' && <FloorPlanViewer expoId={expo._id} />}

          {tab === 'exhibitors' && (
            <>
              {exhibitorList.length === 0 ? (
                <EmptyState icon="building" title="No exhibitors assigned yet" message="Approved exhibitors and their booths will be listed here." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {exhibitorList.map(({ exhibitor, booth }) => (
                    <Card key={exhibitor._id} hover className="card-pad">
                      <div className="flex items-start gap-3">
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
                            Booth {booth.zone}-{booth.number} · {titleCase(booth.size)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">★ {Number(exhibitor.avgRating || 0).toFixed(1)}</p>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{truncate(exhibitor.description || '', 140)}</p>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button size="xs" variant="secondary" icon="map" onClick={() => setTab('floorplan')}>
                          Locate
                        </Button>
                        <Link to={`/exhibitors/${exhibitor.slug || exhibitor._id}`}>
                          <Button size="xs" icon="chevron-right">
                            Profile
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="card-pad">
            <h2 className="text-sm font-semibold">Your registration</h2>
            {myRegistration ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <Badge status={myRegistration.status} dot />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Pass code</span>
                  <span className="font-mono text-xs">{myRegistration.passCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Payment</span>
                  <Badge status={myRegistration.paymentStatus} />
                </div>
                {role === ROLES.ATTENDEE && (
                  <Link to="/attendee/pass" className="block pt-2">
                    <Button className="w-full" icon="qr">
                      Open event pass
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {registrationOpen
                    ? 'Reserve your seat and get a QR pass for check-in at the door.'
                    : 'Registration is currently closed for this expo.'}
                </p>
                <Button
                  className="w-full"
                  icon="ticket"
                  disabled={!registrationOpen}
                  onClick={() => (isAuthenticated ? setRegisterOpen(true) : navigate('/login', { state: { from: `/expos/${id}` } }))}
                >
                  Register now
                </Button>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <h2 className="text-sm font-semibold">Organizer</h2>
            <p className="mt-2 text-sm">{expo.organizer?.name || 'EventSphere team'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{expo.organizer?.email || ''}</p>
            {expo.organizer?.organization && <p className="text-xs text-slate-500 dark:text-slate-400">{expo.organizer.organization}</p>}
          </Card>

          <Card className="card-pad">
            <h2 className="text-sm font-semibold">Get there</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {expo.location?.address || expo.location?.venue || 'Address to be announced'}
            </p>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              icon="location"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    [expo.location?.venue, expo.location?.city, expo.location?.country].filter(Boolean).join(', ') || 'expo venue',
                  )}`,
                  '_blank',
                )
              }
            >
              Open in maps
            </Button>
          </Card>
        </aside>
      </div>

      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title={`Register for ${expo.title}`}
        subtitle="Your details appear on your QR event pass and badge."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={submitting} onClick={register} disabled={!form.fullName || !form.email}>
              {expo.ticketPrice > 0 ? `Continue to payment (${formatCurrency(expo.ticketPrice, expo.currency)})` : 'Confirm registration'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="Organisation">
            <Input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} />
          </Field>
          <Field label="Job title">
            <Input value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} />
          </Field>
          <Field label="Country">
            <Input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          </Field>
          <Field label="Pass type">
            <Select
              value={form.passType}
              onChange={(event) => setForm({ ...form, passType: event.target.value })}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'vip', label: 'VIP' },
              ]}
            />
          </Field>
          <Field label="Accessibility needs">
            <Input value={form.accessibilityNeeds} onChange={(event) => setForm({ ...form, accessibilityNeeds: event.target.value })} />
          </Field>
          <Field label="Dietary requirements" className="sm:col-span-2">
            <Textarea rows={2} value={form.dietaryRequirements} onChange={(event) => setForm({ ...form, dietaryRequirements: event.target.value })} />
          </Field>
        </div>
        {expo.ticketPrice > 0 && (
          <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
            This expo has a ticket price of {formatCurrency(expo.ticketPrice, expo.currency)}. After registering you will be taken to
            the payment step — your pass activates as soon as the payment is confirmed.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default ExpoDetailPage;
