import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate, formatDateTime, initials, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Select } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const AttendeePass = () => {
  const { user } = useAuth();
  const toast = useToast();
  const registrations = useApi(() => api.registrations.mine({ limit: 50 }), []);
  const [activeId, setActiveId] = useState('');
  const [pass, setPass] = useState(null);
  const [loading, setLoading] = useState(false);

  const eligible = (registrations.data || []).filter((item) => ['confirmed', 'attended'].includes(item.status));

  useEffect(() => {
    if (!activeId && eligible.length) setActiveId(eligible[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrations.data]);

  const loadPass = async (registrationId) => {
    setLoading(true);
    try {
      const response = await api.registrations.pass(registrationId || undefined);
      setPass(response.data);
    } catch (error) {
      setPass(null);
      if (error?.status !== 404) toast.error(error?.message || 'The event pass could not be generated');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeId) loadPass(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (registrations.loading && !registrations.data) return <LoadingState rows={3} />;
  if (registrations.error) {
    return (
      <div>
        <PageHeader title="Event pass" />
        <ErrorState error={registrations.error} onRetry={registrations.reload} />
      </div>
    );
  }

  if (eligible.length === 0) {
    return (
      <div>
        <PageHeader title="Event pass" subtitle="Your QR pass is created the moment you register for an expo." icon="qr" />
        <EmptyState
          icon="ticket"
          title="No active pass yet"
          message="Register for an expo and your personal QR pass — valid for check-in at the door, sessions and exhibitor booths — appears here instantly."
          action={
            <Link to="/expos">
              <Button icon="compass">Browse expos</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const registration = pass?.registration || eligible.find((item) => item._id === activeId) || eligible[0];
  const expo = registration?.expo;
  const holder = pass?.holder || user;

  return (
    <div>
      <PageHeader
        title="Event pass"
        subtitle="Show this QR code at the entrance and at exhibitor booths. Staff can also type your pass code manually."
        icon="qr"
        actions={
          <>
            {eligible.length > 1 && (
              <Select
                className="min-w-[240px]"
                value={activeId}
                options={eligible.map((item) => ({ value: item._id, label: item.expo?.title || 'Expo' }))}
                onChange={(event) => setActiveId(event.target.value)}
                aria-label="Select registration"
              />
            )}
            <Button variant="secondary" icon="refresh" loading={loading} onClick={() => loadPass(activeId)}>
              Regenerate pass
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="overflow-hidden">
          <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">EventSphere</p>
                <h2 className="mt-1 text-lg font-bold leading-tight">{expo?.title || 'Event pass'}</h2>
              </div>
              <span className="badge bg-white/20 text-white">{titleCase(registration?.passType || 'standard')} pass</span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-white/80">
              <Icon name="location" className="h-3.5 w-3.5" />
              {expo?.location?.venue || 'Venue TBA'}
              {expo?.location?.city ? `, ${expo.location.city}` : ''}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {formatDate(expo?.startDate)} – {formatDate(expo?.endDate)}
            </p>
          </div>

          <div className="card-pad text-center">
            {pass?.qr?.dataUrl ? (
              <>
                <img
                  src={pass.qr.dataUrl}
                  alt="Event pass QR code"
                  className="mx-auto h-56 w-56 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700"
                />
                <p className="mt-3 font-mono text-base font-semibold tracking-wider">{registration?.passCode}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {pass.qr.payload?.type ? `${titleCase(pass.qr.payload.type)} QR` : 'Signed QR payload'}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" icon="download" onClick={() => window.open(pass.qr.dataUrl, '_blank')}>
                    Open / print
                  </Button>
                  <Button
                    variant="secondary"
                    icon="clipboard"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(registration.passCode);
                        toast.success('Pass code copied');
                      } catch {
                        toast.error('Copying is not available in this browser');
                      }
                    }}
                  >
                    Copy code
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-8">
                <Icon name="qr" className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {loading ? 'Generating your QR pass…' : 'Generate the pass to display your QR code.'}
                </p>
                <Button className="mt-3" icon="qr" loading={loading} onClick={() => loadPass(activeId)}>
                  Generate QR
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            {holder?.avatar ? (
              <img src={mediaUrl(holder.avatar)} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {initials(holder?.name || 'Attendee')}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{holder?.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{holder?.email}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Pass details" subtitle="What this pass unlocks" icon="ticket" />
            <div className="card-pad grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Status', value: <Badge status={registration?.status} dot /> },
                { label: 'Pass code', value: <span className="font-mono">{registration?.passCode || '—'}</span> },
                { label: 'Holder', value: registration?.attendeeDetails?.fullName || user?.name || '—' },
                { label: 'Email', value: registration?.attendeeDetails?.email || user?.email || '—' },
                { label: 'Organisation', value: registration?.attendeeDetails?.organization || user?.organization || '—' },
                { label: 'Registered on', value: formatDate(registration?.createdAt) },
                { label: 'Check-in', value: registration?.checkedIn ? `Scanned ${formatDateTime(registration.checkedInAt)}` : 'Not scanned yet' },
                { label: 'Payment', value: titleCase(registration?.paymentStatus || 'not_required') },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                  <div className="mt-0.5 text-sm">{item.value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Where you can use it" icon="info" />
            <ul className="card-pad grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <span className="block font-medium">Expo entrance</span>
                Staff scan the QR to record your attendance and print a badge.
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <span className="block font-medium">Session rooms</span>
                Scanning marks you as attended so speakers see real numbers.
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <span className="block font-medium">Exhibitor booths</span>
                Share your pass to leave your details with the companies you meet.
              </li>
            </ul>
          </Card>

          <Card className="card-pad">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="sparkles" className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Make the most of the event
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/attendee/sessions">
                <Button size="sm" variant="secondary" icon="mic">
                  My sessions
                </Button>
              </Link>
              <Link to="/attendee/appointments">
                <Button size="sm" variant="secondary" icon="handshake">
                  My appointments
                </Button>
              </Link>
              <Link to="/attendee/floor-plan">
                <Button size="sm" variant="secondary" icon="layers">
                  Floor plan
                </Button>
              </Link>
              <Link to="/attendee/expos">
                <Button size="sm" variant="ghost" icon="calendar">
                  All my expos
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AttendeePass;
