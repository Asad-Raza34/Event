import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useSocket } from '../../context/SocketContext';
import { SOCKET_EVENTS } from '../../lib/socket';
import { BOOTH_COLORS } from '../../lib/constants';
import { cn, formatCurrency, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Input, Spinner, StarRating } from '../../components/ui';
import { DataState, EmptyState } from '../../components/ui/data';

const LEGEND = [
  { status: 'available', label: 'Available' },
  { status: 'reserved', label: 'Reserved' },
  { status: 'occupied', label: 'Occupied' },
  { status: 'maintenance', label: 'Maintenance' },
];

const BoothTile = ({ booth, selected, onClick }) => {
  const tone = BOOTH_COLORS[booth.status] || BOOTH_COLORS.available;
  return (
    <button
      type="button"
      onClick={() => onClick(booth)}
      title={`${booth.zone}-${booth.number} · ${titleCase(booth.status)}`}
      className={cn(
        'group flex h-[86px] flex-col justify-between rounded-xl border-2 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-card',
        tone.bg,
        tone.border,
        selected && 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {booth.zone}-{booth.number}
        </span>
        <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} />
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-200">
        {booth.exhibitor?.companyName || titleCase(booth.size)}
      </span>
      <span className={cn('text-[10px] font-semibold uppercase tracking-wide', tone.text)}>{titleCase(booth.status)}</span>
    </button>
  );
};

const FloorPlanViewer = ({ expoId, onSelectBooth, selectedBoothId, actions, height = 'auto' }) => {
  const { data, loading, error, reload } = useApi(() => api.expos.floorPlan(expoId), [expoId], { enabled: Boolean(expoId) });
  const { subscribe } = useSocket();
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const plan = data?.plan;
  const booths = useMemo(() => data?.booths || [], [data]);
  const summary = data?.summary || {};

  useEffect(() => {
    if (!expoId) return undefined;
    return subscribe(SOCKET_EVENTS.BOOTH_UPDATED, (payload) => {
      if (!payload?.expoId || String(payload.expoId) === String(expoId)) reload();
    });
  }, [expoId, subscribe, reload]);

  useEffect(() => {
    if (selectedBoothId) {
      const match = booths.find((booth) => booth._id === selectedBoothId);
      if (match) setSelected(match);
    }
  }, [selectedBoothId, booths]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return booths.filter((booth) => {
      if (statusFilter && booth.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [booth.number, booth.name, booth.zone, booth.exhibitor?.companyName].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [booths, term, statusFilter]);

  const zones = useMemo(() => {
    const grouped = new Map();
    filtered.forEach((booth) => {
      const zone = booth.zone || 'A';
      if (!grouped.has(zone)) grouped.set(zone, []);
      grouped.get(zone).push(booth);
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleSelect = (booth) => {
    setSelected(booth);
    onSelectBooth?.(booth);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{plan?.name || 'Floor plan'}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {summary.total || 0} booths · {summary.available || 0} available · {summary.occupied || 0} occupied
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                icon="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Booth, zone or company"
                className="w-full sm:w-56"
                aria-label="Search booths"
              />
              <Button variant="secondary" size="sm" icon="refresh" onClick={reload}>
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={cn('badge-neutral text-xs transition', !statusFilter && 'bg-brand-600 text-white dark:bg-brand-600 dark:text-white')}
            >
              All ({booths.length})
            </button>
            {LEGEND.map((item) => (
              <button
                key={item.status}
                type="button"
                onClick={() => setStatusFilter(statusFilter === item.status ? '' : item.status)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition',
                  statusFilter === item.status ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', BOOTH_COLORS[item.status]?.dot)} />
                {item.label} ({summary[item.status] || 0})
              </button>
            ))}
          </div>
        </div>

        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          empty={
            booths.length === 0 ? (
              <EmptyState
                icon="map"
                title="No booths on this floor plan yet"
                message="The organizer has not published booths for this expo. Check back soon or browse another expo."
              />
            ) : null
          }
        >
          <div className="space-y-5" style={height !== 'auto' ? { maxHeight: height, overflowY: 'auto' } : undefined}>
            {zones.length === 0 && (
              <EmptyState icon="search" title="No booths match your filters" message="Try another booth number, company or status." />
            )}
            {zones.map(([zone, items]) => (
              <section key={zone} className="card card-pad">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <Icon name="layers" className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Zone {zone}
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {items.filter((booth) => booth.status === 'available').length} available of {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((booth) => (
                    <BoothTile key={booth._id} booth={booth} selected={selected?._id === booth._id} onClick={handleSelect} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DataState>
      </div>

      <aside className="card card-pad self-start lg:sticky lg:top-24">
        {loading && !selected ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Spinner />
          </div>
        ) : !selected ? (
          <EmptyState
            icon="qr"
            title="Pick a booth"
            message="Select any booth on the plan to see its size, price, exhibitor and products."
            className="border-0 py-6"
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">
                  {selected.zone}-{selected.number}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selected.name || 'Unnamed booth'}</p>
              </div>
              <Badge status={selected.status} dot />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Size</dt>
                <dd>{titleCase(selected.size)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Price</dt>
                <dd>{formatCurrency(selected.price, selected.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Dimensions</dt>
                <dd>
                  {selected.dimensions?.width || '—'} × {selected.dimensions?.depth || '—'} {selected.dimensions?.unit || 'm'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Views</dt>
                <dd>{selected.traffic?.views || 0}</dd>
              </div>
            </dl>

            {selected.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.amenities.map((amenity) => (
                  <span key={amenity} className="badge-neutral text-[11px]">
                    {amenity}
                  </span>
                ))}
              </div>
            )}

            {selected.exhibitor ? (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Exhibitor</p>
                <div className="mt-2 flex items-center gap-3">
                  {selected.exhibitor.logo ? (
                    <img src={mediaUrl(selected.exhibitor.logo)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                      <Icon name="building" className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selected.exhibitor.companyName}</p>
                    <StarRating
                      value={selected.exhibitor.avgRating || 0}
                      count={selected.exhibitor.reviewCount}
                      size="sm"
                      showValue={false}
                    />
                  </div>
                </div>
                {selected.exhibitor.description && (
                  <p className="mt-2 line-clamp-3 text-xs text-slate-500 dark:text-slate-400">{selected.exhibitor.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {selected.exhibitor.slug && (
                    <a className="link" href={`/exhibitors/${selected.exhibitor.slug}`}>
                      View profile
                    </a>
                  )}
                  {selected.exhibitor.website && (
                    <a className="link" href={selected.exhibitor.website} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  )}
                  {selected.exhibitor.contact?.email && <span className="text-slate-500 dark:text-slate-400">{selected.exhibitor.contact.email}</span>}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No exhibitor assigned to this booth yet.
              </p>
            )}

            {selected.featuredProducts?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Featured products</p>
                <ul className="mt-2 space-y-1.5">
                  {selected.featuredProducts.slice(0, 4).map((product) => (
                    <li key={product._id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-700 dark:text-slate-200">{product.name}</span>
                      <span className="shrink-0 text-slate-500 dark:text-slate-400">{formatCurrency(product.price, product.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {actions?.({ booth: selected, reload })}
          </div>
        )}
      </aside>
    </div>
  );
};

export default FloorPlanViewer;
