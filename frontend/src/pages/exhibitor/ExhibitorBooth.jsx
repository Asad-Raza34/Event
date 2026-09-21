import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, mediaUrl, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, CardHeader, Field, Modal, Select, StatCard, Tabs } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const ExhibitorBooth = () => {
  const toast = useToast();
  const workspace = useApi(() => api.exhibitors.workspace(), []);
  const products = useApi(() => api.exhibitors.products({ limit: 100 }), []);
  const [activeId, setActiveId] = useState('');
  const [tab, setTab] = useState('overview');
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [featuredOpen, setFeaturedOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [busy, setBusy] = useState(false);

  const booths = workspace.data?.booths || [];
  const active = booths.find((booth) => booth._id === activeId) || booths[0];

  useEffect(() => {
    if (!activeId && booths.length) setActiveId(booths[0]._id);
  }, [booths, activeId]);

  const loadQr = async () => {
    if (!active) return;
    setQrLoading(true);
    try {
      const response = await api.booths.qr(active._id);
      setQr(response.data);
    } catch (error) {
      toast.error(error?.message || 'The booth QR could not be generated');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (active) {
      setQr(null);
      setSelectedProducts((active.featuredProducts || []).map((product) => product._id || product));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, workspace.data]);

  const saveFeatured = async () => {
    setBusy(true);
    try {
      await api.booths.update(active._id, { featuredProducts: selectedProducts });
      toast.success('Featured products updated');
      setFeaturedOpen(false);
      workspace.reload();
    } catch (error) {
      toast.error(error?.message || 'Could not update the booth');
    } finally {
      setBusy(false);
    }
  };

  const requestRelease = async () => {
    setBusy(true);
    try {
      await api.booths.release(active._id, { reason: 'Release requested by exhibitor' });
      toast.success('Release requested — the organizers will confirm');
      workspace.reload();
    } catch (error) {
      toast.error(error?.message || 'The release request failed');
    } finally {
      setBusy(false);
    }
  };

  if (workspace.loading && !workspace.data) return <LoadingState rows={3} />;
  if (workspace.error) {
    return (
      <div>
        <PageHeader title="My booth" />
        <ErrorState error={workspace.error} onRetry={workspace.reload} />
      </div>
    );
  }

  if (!booths.length) {
    return (
      <div>
        <PageHeader title="My booth" subtitle="Need a space? Apply to an expo and reserve a booth on the floor plan." icon="map" />
        <EmptyState
          icon="map"
          title="No booth assigned yet"
          message="Once an organizer approves your application you can reserve a booth from the interactive floor plan."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/exhibitor/applications">
                <Button icon="clipboard">Apply to an expo</Button>
              </Link>
              <Link to="/exhibitor/floor-plan">
                <Button variant="secondary" icon="layers">
                  Browse floor plans
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My booth"
        subtitle={`${active.zone}-${active.number} · ${active.expo?.title}`}
        icon="map"
        actions={
          <>
            <Select
              className="min-w-[220px]"
              value={activeId}
              options={booths.map((booth) => ({ value: booth._id, label: `${booth.zone}-${booth.number} — ${booth.expo?.title}` }))}
              onChange={(event) => setActiveId(event.target.value)}
              aria-label="Select booth"
            />
            <Link to="/exhibitor/floor-plan">
              <Button variant="secondary" icon="layers">
                Floor plan
              </Button>
            </Link>
            <Button icon="qr" loading={qrLoading} onClick={loadQr}>
              Booth QR
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Booth status" value={titleCase(active.status)} hint={`${titleCase(active.size)} booth`} icon="map" />
        <StatCard label="Booth views" value={active.traffic?.views || 0} hint={`${active.traffic?.checkIns || 0} scanned visits`} icon="eye" tone="info" />
        <StatCard label="Appointments" value={active.traffic?.appointments || 0} hint="Meetings held at this booth" icon="handshake" tone="warning" />
        <StatCard label="Booth fee" value={formatCurrency(active.price, active.currency)} hint={active.assignedAt ? `Assigned ${formatDate(active.assignedAt)}` : 'Pending assignment'} icon="credit-card" tone="success" />
      </div>

      <div className="mt-5">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'overview', label: 'Overview', icon: 'info' },
            { value: 'products', label: 'Featured products', icon: 'box', count: (active.featuredProducts || []).length },
            { value: 'staff', label: 'Booth staff', icon: 'users2', count: (active.staff || []).length },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {tab === 'overview' && (
            <>
              <Card>
                <CardHeader title="Booth details" subtitle="Share these details with your team" icon="map" />
                <div className="card-pad grid gap-4 sm:grid-cols-2">
                  {[
                    { label: 'Booth number', value: `${active.zone}-${active.number}` },
                    { label: 'Name', value: active.name || '—' },
                    { label: 'Size', value: `${titleCase(active.size)} (${active.dimensions?.width || '—'} × ${active.dimensions?.depth || '—'} ${active.dimensions?.unit || 'm'})` },
                    { label: 'Expo', value: active.expo?.title },
                    { label: 'Expo dates', value: active.expo ? `${formatDate(active.expo.startDate)} – ${formatDate(active.expo.endDate)}` : '—' },
                    { label: 'Amenities', value: (active.amenities || []).join(', ') || '—' },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-0.5 text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
                {active.description && (
                  <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">{active.description}</p>
                )}
              </Card>

              <Card>
                <CardHeader title="Setup checklist" subtitle="Get the stand ready before doors open" icon="check" />
                <div className="card-pad">
                  <ul className="space-y-3 text-sm">
                    {[
                      { label: 'Company profile complete', done: Boolean(workspace.data.profile?.description), to: '/exhibitor/company' },
                      { label: 'Products published', done: (products.data || []).length > 0, to: '/exhibitor/products' },
                      { label: 'Booth staff added', done: (active.staff || []).length > 0, to: '/exhibitor/company' },
                      { label: 'Availability slots published', done: true, to: '/exhibitor/availability' },
                      { label: 'Featured products selected', done: (active.featuredProducts || []).length > 0, to: null },
                      { label: 'Booth QR printed for the stand', done: Boolean(qr), to: null },
                    ].map((item) => (
                      <li key={item.label} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <Icon name={item.done ? 'check' : 'alert'} className={`h-4 w-4 ${item.done ? 'text-emerald-500' : 'text-amber-500'}`} />
                          <span className={item.done ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}>{item.label}</span>
                        </span>
                        {!item.done && item.to && (
                          <Link to={item.to} className="link text-xs">
                            Complete
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </>
          )}

          {tab === 'products' && (
            <Card>
              <CardHeader
                title="Featured at this booth"
                subtitle="Up to 20 products shown on the interactive floor plan"
                icon="box"
                action={
                  <Button size="xs" icon="pencil" onClick={() => setFeaturedOpen(true)}>
                    Choose products
                  </Button>
                }
              />
              <div className="card-pad">
                {(active.featuredProducts || []).length === 0 ? (
                  <EmptyState icon="box" title="No featured products" message="Select the products attendees should see first at your booth." className="border-0" />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {active.featuredProducts.map((product) => (
                      <li key={product._id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        {product.image ? (
                          <img src={mediaUrl(product.image)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <Icon name="box" className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(product.price, product.currency)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}

          {tab === 'staff' && (
            <Card>
              <CardHeader
                title="Booth staff"
                subtitle="Team members working the stand"
                icon="users2"
                action={
                  <Link to="/exhibitor/company">
                    <Button size="xs" variant="secondary">
                      Manage staff
                    </Button>
                  </Link>
                }
              />
              <div className="card-pad">
                {(active.staff || []).length === 0 ? (
                  <EmptyState icon="users2" title="No staff assigned" message="Add staff from your company profile; they will appear here." className="border-0" />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {active.staff.map((member) => (
                      <li key={member._id || member.name} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
                        {member.email && <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="Booth QR sign" subtitle="Attendees scan to record a visit" icon="qr" />
            <div className="card-pad text-center">
              {qr?.dataUrl ? (
                <>
                  <img src={qr.dataUrl} alt="Booth QR code" className="mx-auto h-44 w-44 rounded-xl border border-slate-200 dark:border-slate-700" />
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Booth {active.zone}-{active.number}</p>
                  <Button variant="secondary" className="mt-3 w-full" icon="download" onClick={() => window.open(qr.dataUrl, '_blank')}>
                    Open / print
                  </Button>
                </>
              ) : (
                <>
                  <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <Icon name="qr" className="h-8 w-8" />
                  </span>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Generate a QR code to print for your stand.</p>
                  <Button className="mt-3 w-full" icon="qr" loading={qrLoading} onClick={loadQr}>
                    Generate QR
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Booth actions" icon="spark" />
            <div className="card-pad space-y-2">
              <Link to={`/expos/${active.expo?.slug || active.expo?._id}`} className="block">
                <Button variant="secondary" className="w-full justify-start" icon="calendar">
                  View expo page
                </Button>
              </Link>
              <Link to="/exhibitor/appointments" className="block">
                <Button variant="secondary" className="w-full justify-start" icon="handshake">
                  Booth appointments
                </Button>
              </Link>
              <Link to="/exhibitor/analytics" className="block">
                <Button variant="secondary" className="w-full justify-start" icon="chart">
                  Traffic analytics
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start" icon="x" loading={busy} onClick={requestRelease}>
                Request booth release
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      <Modal
        open={featuredOpen}
        onClose={() => setFeaturedOpen(false)}
        title="Choose featured products"
        subtitle="These appear on your booth card across the floor plan and expo pages."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeaturedOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" loading={busy} onClick={saveFeatured}>
              Save selection
            </Button>
          </>
        }
      >
        <Field label="Products" hint="Hold ⌘/Ctrl to select multiple (max 20)">
          <select
            multiple
            value={selectedProducts}
            onChange={(event) => setSelectedProducts(Array.from(event.target.options).filter((option) => option.selected).map((option) => option.value).slice(0, 20))}
            className="input h-64"
          >
            {(products.data || []).map((product) => (
              <option key={product._id} value={product._id}>
                {product.name} — {titleCase(product.kind)}
              </option>
            ))}
          </select>
        </Field>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{selectedProducts.length} of 20 selected</p>
      </Modal>
    </div>
  );
};

export default ExhibitorBooth;
