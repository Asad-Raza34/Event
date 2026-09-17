import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLES } from '../../lib/constants';
import { formatCurrency, formatDate, formatTime, initials, mediaUrl, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Input, Modal, Select, StarRating, Tabs, Textarea } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const ExhibitorDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated, role, homeRoute } = useAuth();
  const detail = useApi(() => api.exhibitors.detail(id), [id]);
  const [tab, setTab] = useState('about');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [slotId, setSlotId] = useState('');
  const [topic, setTopic] = useState('');
  const [agenda, setAgenda] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const slots = useApi(() => api.exhibitors.availableSlots(id, { availableOnly: 'true', limit: 30 }), [id], { enabled: bookingOpen });

  const profile = detail.data?.profile;
  const products = detail.data?.products || [];
  const booths = detail.data?.booths || [];
  const reviews = detail.data?.reviews || [];
  const breakdown = detail.data?.ratingBreakdown || {};

  const groupedSlots = useMemo(() => {
    const map = new Map();
    (slots.data || []).forEach((slot) => {
      const key = new Date(slot.date).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    });
    return Array.from(map.entries());
  }, [slots.data]);

  const startChat = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/exhibitors/${id}` } });
      return;
    }
    try {
      const response = await api.chat.startWithExhibitor(profile._id, {});
      toast.success('Conversation opened');
      navigate(`/${role}/messages?conversation=${response.data.conversation._id}`);
    } catch (error) {
      toast.error(error?.message || 'Could not start the conversation');
    }
  };

  const bookAppointment = async () => {
    if (!slotId) {
      toast.warning('Choose a time slot first');
      return;
    }
    setSubmitting(true);
    try {
      await api.appointments.request({ slotId, topic, agenda });
      toast.success('Appointment requested — the exhibitor will confirm shortly');
      setBookingOpen(false);
      setSlotId('');
      setTopic('');
      setAgenda('');
      navigate('/attendee/appointments');
    } catch (error) {
      toast.error(error?.message || 'The appointment could not be requested');
    } finally {
      setSubmitting(false);
    }
  };

  const writeReview = async (rating, comment) => {
    try {
      await api.reviews.create({ targetType: 'exhibitor', targetId: profile._id, rating, comment });
      toast.success('Thanks for your review!');
      detail.reload();
    } catch (error) {
      toast.error(error?.message || 'Your review could not be saved');
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Exhibitors', to: '/exhibitors' }, { label: profile.companyName }]}
        actions={
          <>
            <Button variant="secondary" icon="chat" onClick={startChat}>
              Message
            </Button>
            <Button
              icon="handshake"
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login', { state: { from: `/exhibitors/${id}` } });
                  return;
                }
                setBookingOpen(true);
              }}
            >
              Book a meeting
            </Button>
          </>
        }
        title={profile.companyName}
      />

      <Card className="overflow-hidden">
        <div className="h-32 w-full bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500" />
        <div className="flex flex-wrap items-start gap-5 px-6 pb-6">
          <div className="-mt-10">
            {profile.logo ? (
              <img src={mediaUrl(profile.logo)} alt="" className="h-24 w-24 rounded-2xl border-4 border-white object-cover dark:border-slate-900" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-brand-50 text-2xl font-bold text-brand-700 dark:border-slate-900 dark:bg-brand-950 dark:text-brand-300">
                {initials(profile.companyName)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{profile.companyName}</h1>
              {profile.verificationStatus === 'verified' && <Badge tone="success">Verified exhibitor</Badge>}
              {profile.isFeatured && <Badge tone="info">Featured</Badge>}
            </div>
            {profile.tagline && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{profile.tagline}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <StarRating value={profile.avgRating || 0} count={profile.reviewCount || 0} />
              <span className="inline-flex items-center gap-1.5">
                <Icon name="location" className="h-4 w-4" />
                {[profile.contact?.city, profile.contact?.country].filter(Boolean).join(', ') || 'Location on request'}
              </span>
              {profile.website && (
                <a className="link inline-flex items-center gap-1.5" href={profile.website} target="_blank" rel="noreferrer">
                  <Icon name="globe" className="h-4 w-4" /> Website
                </a>
              )}
              {profile.contact?.email && (
                <a className="link inline-flex items-center gap-1.5" href={`mailto:${profile.contact.email}`}>
                  <Icon name="mail" className="h-4 w-4" /> {profile.contact.email}
                </a>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(profile.categories || []).map((category) => (
                <span key={category} className="badge-brand text-[11px]">
                  {titleCase(category)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'about', label: 'Overview', icon: 'info' },
            { value: 'products', label: 'Products', icon: 'box', count: products.length },
            { value: 'booths', label: 'Booths', icon: 'map', count: booths.length },
            { value: 'reviews', label: 'Reviews', icon: 'star', count: reviews.length },
            { value: 'slots', label: 'Availability', icon: 'clock' },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {tab === 'about' && (
            <Card className="card-pad">
              <h2 className="text-base font-semibold">About {profile.companyName}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                {profile.description || 'This exhibitor has not added a company description yet.'}
              </p>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Industry', value: (profile.categories || []).map(titleCase).join(', ') || '—' },
                  { label: 'Employees', value: profile.companySize || '—' },
                  { label: 'Founded', value: profile.foundedYear || '—' },
                  { label: 'Phone', value: profile.contact?.phone || '—' },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</dt>
                    <dd className="mt-0.5 text-sm">{item.value}</dd>
                  </div>
                ))}
              </dl>

              {profile.staff?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold">Team at the booth</h3>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {profile.staff.map((member) => (
                      <li key={member._id || member.name} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          {initials(member.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{member.name}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{member.role}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {tab === 'products' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.length === 0 ? (
                <EmptyState
                  icon="box"
                  title="No products published"
                  className="sm:col-span-2"
                  message="This exhibitor has not listed products or services yet."
                />
              ) : (
                products.map((product) => (
                  <Card key={product._id} className="card-pad">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{product.name}</h3>
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {titleCase(product.kind)} · {titleCase(product.category)}
                        </p>
                      </div>
                      {product.isFeatured && <Badge tone="info">Featured</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{truncate(product.description || '', 160)}</p>
                    <p className="mt-3 text-sm font-semibold">{product.price > 0 ? formatCurrency(product.price, product.currency) : 'On request'}</p>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === 'booths' && (
            <Card className="card-pad">
              <h2 className="text-base font-semibold">Booth locations</h2>
              {booths.length === 0 ? (
                <EmptyState icon="map" title="No booths assigned yet" className="mt-4 border-0" message="Booth assignments appear once the organizer confirms them." />
              ) : (
                <ul className="mt-4 space-y-3">
                  {booths.map((booth) => (
                    <li key={booth._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-semibold">
                          {booth.zone}-{booth.number} {booth.name ? `· ${booth.name}` : ''}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {booth.expo?.title} · {formatDate(booth.expo?.startDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={booth.status} dot />
                        {booth.expo && (
                          <Link to={`/expos/${booth.expo.slug || booth.expo._id}`}>
                            <Button size="xs" variant="secondary" icon="layers">
                              Floor plan
                            </Button>
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === 'reviews' && (
            <div className="space-y-4">
              {isAuthenticated && role === ROLES.ATTENDEE && <ReviewComposer onSubmit={writeReview} />}
              {reviews.length === 0 ? (
                <EmptyState icon="star" title="No reviews yet" message="Be the first to share your experience with this exhibitor." />
              ) : (
                reviews.map((review) => (
                  <Card key={review._id} className="card-pad">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                          {initials(review.author?.name || 'Guest')}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{review.author?.name || 'EventSphere attendee'}</p>
                          <StarRating value={review.rating} size="sm" showValue={false} />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                    </div>
                    {review.title && <p className="mt-3 text-sm font-semibold">{review.title}</p>}
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>
                    {review.replies?.length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                        {review.replies.map((reply) => (
                          <p key={reply._id} className="text-sm text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{reply.author?.name || 'Exhibitor'}:</span> {reply.body}
                          </p>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === 'slots' && (
            <Card className="card-pad">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Available meeting slots</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pick a slot and request a meeting — it stays pending until the exhibitor confirms.</p>
                </div>
                <Button icon="handshake" onClick={() => setBookingOpen(true)}>
                  Book a meeting
                </Button>
              </div>

              {slots.loading ? (
                <LoadingState rows={2} className="mt-4" />
              ) : groupedSlots.length === 0 ? (
                <EmptyState icon="clock" title="No open slots" className="mt-4 border-0" message="This exhibitor has not published availability yet." />
              ) : (
                <div className="mt-4 space-y-4">
                  {groupedSlots.map(([day, daySlots]) => (
                    <div key={day}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{day}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <button
                            key={slot._id}
                            type="button"
                            onClick={() => {
                              setSlotId(slot._id);
                              setBookingOpen(true);
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium transition hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-950"
                          >
                            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">{slot.durationMinutes} min</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="card-pad">
            <h2 className="text-sm font-semibold">Rating breakdown</h2>
            <div className="mt-3 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = breakdown[star] || 0;
                const total = reviews.length || 1;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-slate-500 dark:text-slate-400">{star}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.round((count / total) * 100)}%` }} />
                    </span>
                    <span className="w-8 text-right text-slate-500 dark:text-slate-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="card-pad">
            <h2 className="text-sm font-semibold">Quick actions</h2>
            <div className="mt-3 space-y-2">
              <Button variant="secondary" className="w-full justify-start" icon="chat" onClick={startChat}>
                Message this exhibitor
              </Button>
              <Button variant="secondary" className="w-full justify-start" icon="handshake" onClick={() => setBookingOpen(true)}>
                Request a meeting
              </Button>
              {booths[0]?.expo && (
                <Link to={`/expos/${booths[0].expo.slug || booths[0].expo._id}`} className="block">
                  <Button variant="secondary" className="w-full justify-start" icon="layers">
                    View on the floor plan
                  </Button>
                </Link>
              )}
              {isAuthenticated && (
                <Link to={homeRoute} className="block">
                  <Button variant="ghost" className="w-full justify-start" icon="grid">
                    Back to dashboard
                  </Button>
                </Link>
              )}
            </div>
          </Card>

          {profile.socials && Object.keys(profile.socials).length > 0 && (
            <Card className="card-pad">
              <h2 className="text-sm font-semibold">Social</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {Object.entries(profile.socials).map(([network, url]) => (
                  <li key={network}>
                    <a className="link inline-flex items-center gap-2" href={url} target="_blank" rel="noreferrer">
                      <Icon name="globe" className="h-4 w-4" /> {titleCase(network)}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <Modal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title={`Book a meeting with ${profile.companyName}`}
        subtitle="Choose an open slot and tell the exhibitor what you would like to discuss."
        footer={
          <>
            <Button variant="secondary" onClick={() => setBookingOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={submitting} onClick={bookAppointment}>
              Request appointment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Time slot" required error={!slots.data?.length ? 'No open slots available right now' : undefined}>
            {slots.loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading availability…</p>
            ) : (
              <Select
                value={slotId}
                placeholder="Pick a slot"
                onChange={(event) => setSlotId(event.target.value)}
                options={(slots.data || []).map((slot) => ({
                  value: slot._id,
                  label: `${formatDate(slot.date)} · ${formatTime(slot.startTime)}–${formatTime(slot.endTime)} (${slot.durationMinutes} min)`,
                }))}
              />
            )}
          </Field>
          <Field label="Topic" required>
            <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Distributor partnership in EMEA" maxLength={200} />
          </Field>
          <Field label="Agenda" hint="Optional — share what you would like to cover.">
            <Textarea value={agenda} onChange={(event) => setAgenda(event.target.value)} rows={3} />
          </Field>
          {!isAuthenticated && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              You need an attendee account to book a meeting. <Link className="link" to="/register">Create one in a minute</Link>.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};

const ReviewComposer = ({ onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  return (
    <Card className="card-pad">
      <h2 className="text-sm font-semibold">Share your experience</h2>
      <div className="mt-2 flex items-center gap-3">
        <StarRating value={rating} onChange={setRating} size="lg" showValue={false} />
        <span className="text-sm text-slate-500 dark:text-slate-400">{rating} of 5</span>
      </div>
      <Textarea className="mt-3" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What stood out at their booth?" />
      <div className="mt-3 flex justify-end">
        <Button icon="star" onClick={() => onSubmit(rating, comment)} disabled={!comment.trim()}>
          Publish review
        </Button>
      </div>
    </Card>
  );
};

export default ExhibitorDetailPage;
