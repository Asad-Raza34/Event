import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Modal, Select, Textarea } from '../../components/ui';
import { EmptyState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FloorPlanViewer from '../../features/floorplan/FloorPlanViewer';

const ExhibitorFloorPlan = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const expoId = params.get('expo') || '';
  const workspace = useApi(() => api.exhibitors.workspace(), []);
  const expos = useApi(() => api.expos.list({ limit: 100, upcoming: 'true', sort: 'startDate' }), []);
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const myExpos = (workspace.data?.applications || []).filter((application) => application.status !== 'rejected');
  const options = [
    ...myExpos.map((application) => ({ value: application.expo?._id, label: `${application.expo?.title} (applied)` })),
    ...(expos.data || []).map((expo) => ({ value: expo._id, label: expo.title })),
  ].filter((option, index, list) => option.value && list.findIndex((item) => item.value === option.value) === index);

  useEffect(() => {
    if (!expoId && options.length) setParams({ expo: options[0].value }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expoId, options.length]);

  const requestBooth = async () => {
    setBusy(true);
    try {
      await api.booths.request(target._id, { note });
      toast.success('Booth request submitted — the organizers will review it');
      setTarget(null);
      setNote('');
    } catch (error) {
      toast.error(error?.message || 'The booth request failed');
    } finally {
      setBusy(false);
    }
  };

  const myBooths = workspace.data?.booths || [];

  return (
    <div>
      <PageHeader
        title="Interactive floor plan"
        subtitle="Find available booths, see where other exhibitors are located and request your space."
        icon="layers"
        actions={
          <Select
            className="min-w-[240px]"
            value={expoId}
            placeholder="Select an expo"
            options={options}
            onChange={(event) => setParams({ expo: event.target.value }, { replace: true })}
            aria-label="Select expo"
          />
        }
      />

      {myBooths.length > 0 && (
        <Card className="card-pad mb-5">
          <h2 className="text-sm font-semibold">Your booths</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {myBooths.map((booth) => (
              <div key={booth._id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                <span className="text-sm font-bold">
                  {booth.zone}-{booth.number}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{booth.expo?.title}</span>
                <Badge status={booth.status} dot />
                {booth.expo?._id === expoId && <span className="badge-info text-[10px]">Highlighted below</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!expoId ? (
        <EmptyState
          icon="calendar"
          title="No expo selected"
          message="Choose an expo above — or apply to one first to unlock booth reservations."
          action={
            <Link to="/exhibitor/applications">
              <Button icon="clipboard">Apply to an expo</Button>
            </Link>
          }
        />
      ) : (
        <FloorPlanViewer
          expoId={expoId}
          selectedBoothId={myBooths.find((booth) => String(booth.expo?._id || booth.expo) === String(expoId))?._id}
          actions={({ booth }) => (
            <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              {booth.status === 'available' && (
                <>
                  <Button className="w-full" icon="handshake" onClick={() => setTarget(booth)}>
                    Request this booth
                  </Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCurrency(booth.price, booth.currency)} · {titleCase(booth.size)} — reserved on approval, payment follows.
                  </p>
                </>
              )}
              {booth.status === 'reserved' && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This booth is reserved pending organizer approval. If it frees up it becomes available again.
                </p>
              )}
              {booth.status === 'occupied' && <p className="text-xs text-slate-500 dark:text-slate-400">This booth is occupied by another exhibitor.</p>}
              {booth.status === 'maintenance' && <p className="text-xs text-slate-500 dark:text-slate-400">This booth is out of service for maintenance.</p>}
            </div>
          )}
        />
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={`Request booth ${target?.zone}-${target?.number}`}
        subtitle="The organizing team reviews every booth request before it is confirmed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button icon="send" loading={busy} onClick={requestBooth}>
              Submit request
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
              <p className="font-medium">
                {target.zone}-{target.number} · {titleCase(target.size)}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {formatCurrency(target.price, target.currency)} · {target.dimensions?.width || '—'} × {target.dimensions?.depth || '—'} m
              </p>
              {target.amenities?.length > 0 && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Amenities: {target.amenities.join(', ')}</p>}
            </div>
            <Field label="Note for the organizers">
              <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="We would like a corner position close to the entrance." />
            </Field>
            <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-950/60 dark:text-brand-200">
              <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              On approval you receive the booth assignment and an invoice for {formatCurrency(target.price, target.currency)}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExhibitorFloorPlan;
