import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { cn, formatDateTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Button, Input, Select, Spinner } from '../../components/ui';

const TYPES = [
  { value: 'event', label: 'Event pass' },
  { value: 'booth', label: 'Booth' },
  { value: 'session', label: 'Session' },
];

const CheckInScanner = ({ expoId, onCheckedIn }) => {
  const [manualCode, setManualCode] = useState('');
  const [type, setType] = useState('event');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const regionId = 'eventsphere-qr-region';

  const submit = useCallback(
    async (code) => {
      const value = String(code || '').trim();
      if (!value) return;
      setBusy(true);
      setError(null);
      try {
        const response = await api.checkIns.scan({ code: value, type, expoId: expoId || undefined });
        setResult(response.data);
        setManualCode('');
        onCheckedIn?.(response.data);
      } catch (caught) {
        setResult(null);
        setError(caught?.message || 'This code could not be processed');
      } finally {
        setBusy(false);
      }
    },
    [type, expoId, onCheckedIn],
  );

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.clear();
    } catch {
      /* the element may already be gone */
    }
    setScanning(false);
  }, []);

  useEffect(
    () => () => {
      stopScanner();
    },
    [stopScanner],
  );

  const startScanner = async () => {
    if (scanning) {
      stopScanner();
      return;
    }
    setError(null);
    setScanning(true);
    try {
      // Loaded on demand so the QR library never lands in the main bundle.
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      const scanner = new Html5QrcodeScanner(
        regionId,
        { fps: 10, qrbox: { width: 240, height: 240 }, rememberLastUsedCamera: true, supportedScanTypes: [0] },
        false,
      );
      scannerRef.current = scanner;
      scanner.render(
        (decodedText) => {
          submit(decodedText);
        },
        () => {},
      );
    } catch (caught) {
      setScanning(false);
      setError(caught?.message || 'Camera access was refused. Type the pass code instead.');
    }
  };

  const event = result?.type === 'event' ? result.registration : null;

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="label" htmlFor="scan-code">
              Code or pass ID
            </label>
            <Input
              id="scan-code"
              icon="qr"
              value={manualCode}
              onChange={(changed) => setManualCode(changed.target.value)}
              onKeyDown={(changed) => changed.key === 'Enter' && submit(manualCode)}
              placeholder="Paste the QR payload or pass code"
            />
          </div>
          <div className="w-[150px]">
            <label className="label" htmlFor="scan-type">
              Check-in type
            </label>
            <Select id="scan-type" value={type} onChange={(changed) => setType(changed.target.value)} options={TYPES} />
          </div>
          <Button icon="check" loading={busy} onClick={() => submit(manualCode)} disabled={!manualCode.trim()}>
            Check in
          </Button>
          <Button variant="secondary" icon="qr" onClick={startScanner}>
            {scanning ? 'Stop camera' : 'Scan with camera'}
          </Button>
        </div>

        <div id={regionId} className={cn('mt-4 overflow-hidden rounded-xl', !scanning && 'hidden')} />

        {busy && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Spinner size="sm" /> Validating code…
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="alert" className="h-4 w-4" /> Check-in failed
          </p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {result && (
        <div
          className={cn(
            'rounded-2xl border px-4 py-4',
            result.alreadyCheckedIn
              ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
              : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
          )}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon name={result.alreadyCheckedIn ? 'info' : 'check'} className="h-4 w-4" />
            {result.alreadyCheckedIn ? 'Already checked in' : 'Checked in successfully'} · {titleCase(result.type)}
          </p>

          {event && (
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Attendee</span>
                <span className="font-medium">{event.user?.name || event.attendeeDetails?.fullName}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{event.user?.email || event.attendeeDetails?.email}</span>
              </p>
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Expo</span>
                <span className="font-medium">{event.expo?.title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Pass {event.passCode}</span>
              </p>
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
                <span className="font-medium">{titleCase(event.status)}</span>
              </p>
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Recorded</span>
                <span className="font-medium">{result.checkIn?.checkedInAt ? formatDateTime(result.checkIn.checkedInAt) : 'now'}</span>
              </p>
            </div>
          )}

          {result.type === 'booth' && result.booth && (
            <p className="mt-3 text-sm">
              Booth <span className="font-semibold">{result.booth.zone}-{result.booth.number}</span>
              {result.booth.exhibitor?.companyName ? ` · ${result.booth.exhibitor.companyName}` : ''}
            </p>
          )}

          {result.type === 'session' && result.session && (
            <p className="mt-3 text-sm">
              Session <span className="font-semibold">{result.session.title}</span> · {formatDateTime(result.session.date)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckInScanner;
