import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { BOOTH_ZONES } from '../../lib/constants';
import { formatCurrency, formatNumber } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Field, Input, ProgressBar, Select, Tabs, Textarea } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FloorPlanViewer from '../../features/floorplan/FloorPlanViewer';

const DEFAULT_ZONES = [
  { name: 'A', color: '#6366f1', description: 'Premium front-of-house zone' },
  { name: 'B', color: '#06b6d4', description: 'Central showcase zone' },
  { name: 'C', color: '#f59e0b', description: 'Startup & innovation zone' },
];

const AdminFloorPlans = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const expoId = params.get('expo') || '';
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true', sort: '-startDate' }), []);
  const layout = useApi(() => api.expos.floorPlan(expoId), [expoId], { enabled: Boolean(expoId) });
  const occupancy = useApi(() => api.expos.occupancy(expoId), [expoId], { enabled: Boolean(expoId) });
  const [tab, setTab] = useState('view');
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expoId && expos.data?.length) setParams({ expo: expos.data[0]._id }, { replace: true });
  }, [expoId, expos.data, setParams]);

  useEffect(() => {
    if (layout.data?.plan) {
      const source = layout.data.plan;
      setPlan({
        name: source.name || '',
        gridCols: source.gridCols || 20,
        gridRows: source.gridRows || 12,
        notes: source.notes || '',
        zones: (source.zones || []).map((zone) => ({ name: zone.name, color: zone.color, description: zone.description })),
      });
    }
  }, [layout.data]);

  const savePlan = async () => {
    setSaving(true);
    try {
      await api.expos.updateFloorPlan(expoId, plan);
      toast.success('Floor plan updated');
      layout.reload();
    } catch (error) {
      toast.error(error?.message || 'The floor plan could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const zones = Array.isArray(occupancy.data) ? occupancy.data : [];
  const totals = zones.reduce(
    (acc, zone) => ({
      total: acc.total + zone.total,
      occupied: acc.occupied + zone.occupied,
      available: acc.available + zone.available,
      maintenance: acc.maintenance + zone.maintenance,
      revenue: acc.revenue + (zone.revenue || 0),
    }),
    { total: 0, occupied: 0, available: 0, maintenance: 0, revenue: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Floor plans"
        subtitle="Design the hall layout, publish booth zones and monitor occupancy in real time."
        icon="layers"
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
            <Link to={`/admin/booths?expo=${expoId}`}>
              <Button variant="secondary" icon="map">
                Manage booths
              </Button>
            </Link>
            {tab === 'edit' && (
              <Button icon="check" loading={saving} onClick={savePlan} disabled={!plan}>
                Save floor plan
              </Button>
            )}
          </>
        }
      />

      {!expoId ? (
        <EmptyState icon="calendar" title="Choose an expo" message="Select an expo to view and edit its floor plan." />
      ) : layout.loading ? (
        <LoadingState rows={3} />
      ) : layout.error ? (
        <ErrorState error={layout.error} onRetry={layout.reload} />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Total booths', value: formatNumber(totals.total), icon: 'map' },
              { label: 'Occupied / reserved', value: formatNumber(totals.occupied), icon: 'building' },
              { label: 'Available', value: formatNumber(totals.available), icon: 'check' },
              { label: 'Maintenance', value: formatNumber(totals.maintenance), icon: 'alert' },
              { label: 'Booth revenue', value: formatCurrency(totals.revenue), icon: 'credit-card' },
            ].map((item) => (
              <Card key={item.label} className="card-pad">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                    <Icon name={item.icon} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="text-lg font-bold">{item.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mb-4">
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[
                { value: 'view', label: 'Interactive plan', icon: 'layers' },
                { value: 'zones', label: 'Zone occupancy', icon: 'chart' },
                { value: 'edit', label: 'Edit layout', icon: 'pencil' },
              ]}
            />
          </div>

          {tab === 'view' && <FloorPlanViewer expoId={expoId} />}

          {tab === 'zones' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {zones.length === 0 ? (
                <EmptyState icon="map" title="No booths yet" message="Generate booths to see occupancy per zone." />
              ) : (
                zones.map((zone) => (
                  <Card key={zone.zone} className="card-pad">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Zone {zone.zone}</h3>
                      <Badge tone={zone.available === 0 ? 'danger' : 'success'}>{zone.total} booths</Badge>
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Occupied / reserved</span>
                        <span className="font-medium">
                          {zone.occupied} of {zone.total}
                        </span>
                      </div>
                      <ProgressBar value={zone.occupied} max={zone.total || 1} />
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Available</span>
                        <span className="font-medium">{zone.available}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Maintenance</span>
                        <span className="font-medium">{zone.maintenance}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">Booked value</span>
                        <span className="font-semibold">{formatCurrency(zone.revenue || 0)}</span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === 'edit' && plan && (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <Card>
                <CardHeader title="Layout settings" subtitle="Grid size controls how booths are positioned" icon="settings" />
                <div className="card-pad grid gap-4 sm:grid-cols-2">
                  <Field label="Plan name" className="sm:col-span-2">
                    <Input value={plan.name} onChange={(event) => setPlan({ ...plan, name: event.target.value })} />
                  </Field>
                  <Field label="Grid columns" hint="4–80">
                    <Input
                      type="number"
                      min="4"
                      max="80"
                      value={plan.gridCols}
                      onChange={(event) => setPlan({ ...plan, gridCols: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Grid rows" hint="4–80">
                    <Input
                      type="number"
                      min="4"
                      max="80"
                      value={plan.gridRows}
                      onChange={(event) => setPlan({ ...plan, gridRows: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Notes for staff" className="sm:col-span-2">
                    <Textarea rows={3} value={plan.notes} onChange={(event) => setPlan({ ...plan, notes: event.target.value })} />
                  </Field>
                </div>
              </Card>

              <Card>
                <CardHeader title="Zones" subtitle="Colour-coded areas on the plan" icon="layers" />
                <div className="card-pad space-y-3">
                  {plan.zones.map((zone, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={zone.color || '#6366f1'}
                          onChange={(event) => {
                            const next = [...plan.zones];
                            next[index] = { ...zone, color: event.target.value };
                            setPlan({ ...plan, zones: next });
                          }}
                          className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700"
                          aria-label={`Zone ${index + 1} colour`}
                        />
                        <Select
                          value={zone.name}
                          options={BOOTH_ZONES.map((letter) => ({ value: letter, label: `Zone ${letter}` }))}
                          onChange={(event) => {
                            const next = [...plan.zones];
                            next[index] = { ...zone, name: event.target.value };
                            setPlan({ ...plan, zones: next });
                          }}
                        />
                        <Button
                          size="xs"
                          variant="ghost"
                          icon="trash"
                          onClick={() => setPlan({ ...plan, zones: plan.zones.filter((_, position) => position !== index) })}
                          aria-label="Remove zone"
                        />
                      </div>
                      <Input
                        className="mt-2"
                        value={zone.description || ''}
                        placeholder="Zone description"
                        onChange={(event) => {
                          const next = [...plan.zones];
                          next[index] = { ...zone, description: event.target.value };
                          setPlan({ ...plan, zones: next });
                        }}
                      />
                    </div>
                  ))}

                  <Button
                    variant="secondary"
                    className="w-full"
                    icon="plus"
                    onClick={() =>
                      setPlan({ ...plan, zones: [...plan.zones, { name: 'A', color: '#8b5cf6', description: '' }] })
                    }
                  >
                    Add zone
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    icon="refresh"
                    onClick={() => setPlan({ ...plan, zones: DEFAULT_ZONES })}
                  >
                    Reset to default zones
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminFloorPlans;
