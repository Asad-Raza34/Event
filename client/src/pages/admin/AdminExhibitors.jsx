import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useListQuery } from '../../hooks/useListQuery';
import { useToast } from '../../context/ToastContext';
import { COMPANY_CATEGORIES } from '../../lib/constants';
import { formatCurrency, formatDate, formatDateTime, mediaUrl, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Field, Modal, Select, StarRating, Table, Tabs, Textarea } from '../../components/ui';
import { DataState, EmptyState, Pagination, TableSkeleton } from '../../components/ui/data';
import { Drawer } from '../../components/ui/overlay';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const APPLICATION_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'withdrawn'];

const AdminExhibitors = () => {
  const toast = useToast();
  const [tab, setTab] = useState('applications');
  const expos = useApi(() => api.expos.list({ limit: 100, includeDrafts: 'true' }), []);
  const applications = useListQuery((query) => api.exhibitors.applications(query), { limit: 12 }, [tab]);
  const directory = useListQuery((query) => api.exhibitors.directory(query), { limit: 12 }, [tab]);
  const [review, setReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ status: 'approved', reviewNote: '', boothId: '' });
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);

  const booths = useApi(() => api.booths.list({ expo: review?.expo?._id, status: 'available', limit: 100 }), [review?.expo?._id], {
    enabled: Boolean(review?.expo?._id),
  });

  const submitReview = async () => {
    setBusy(true);
    try {
      await api.exhibitors.reviewApplication(review._id, {
        status: reviewForm.status,
        reviewNote: reviewForm.reviewNote,
        boothId: reviewForm.boothId || undefined,
      });
      toast.success(`Application ${reviewForm.status.replace('_', ' ')}`);
      setReview(null);
      applications.reload();
    } catch (error) {
      toast.error(error?.message || 'The application could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const setVerification = async (exhibitor, verificationStatus) => {
    try {
      await api.exhibitors.setVerification(exhibitor._id, { verificationStatus });
      toast.success(`Exhibitor marked as ${verificationStatus}`);
      directory.reload();
    } catch (error) {
      toast.error(error?.message || 'Verification could not be updated');
    }
  };

  const applicationColumns = [
    {
      key: 'company',
      label: 'Company',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.exhibitor?.logo ? (
            <img src={mediaUrl(row.exhibitor.logo)} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Icon name="building" className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.exhibitor?.companyName}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.exhibitor?.contact?.email || row.contact?.email || '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'expo', label: 'Expo', render: (row) => <span className="text-sm">{row.expo?.title}</span> },
    {
      key: 'preferences',
      label: 'Booth preferences',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {titleCase(row.boothPreferences?.size || 'medium')} · zone {row.boothPreferences?.zone || 'any'}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} dot /> },
    { key: 'submittedAt', label: 'Submitted', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="xs" variant="secondary" icon="eye" onClick={() => setDetail(row)}>
            View
          </Button>
          <Button
            size="xs"
            icon="check"
            onClick={() => {
              setReview(row);
              setReviewForm({ status: 'approved', reviewNote: '', boothId: '' });
            }}
          >
            Review
          </Button>
        </div>
      ),
    },
  ];

  const exhibitorColumns = [
    {
      key: 'company',
      label: 'Exhibitor',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.logo ? (
            <img src={mediaUrl(row.logo)} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <Icon name="building" className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <Link to={`/exhibitors/${row.slug || row._id}`} className="truncate text-sm font-medium hover:text-brand-600">
              {row.companyName}
            </Link>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{(row.categories || []).map(titleCase).join(' · ') || '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'rating', label: 'Rating', render: (row) => <StarRating value={row.avgRating || 0} count={row.reviewCount || 0} size="sm" /> },
    { key: 'contact', label: 'Contact', render: (row) => <span className="text-xs">{[row.contact?.city, row.contact?.country].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'verification', label: 'Verification', render: (row) => <Badge status={row.verificationStatus || 'pending'} /> },
    { key: 'profileViews', label: 'Profile views', render: (row) => <span className="text-sm">{row.profileViews || 0}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.verificationStatus !== 'verified' && (
            <Button size="xs" variant="success" icon="check" onClick={() => setVerification(row, 'verified')}>
              Verify
            </Button>
          )}
          {row.verificationStatus === 'verified' && (
            <Button size="xs" variant="ghost" onClick={() => setVerification(row, 'rejected')}>
              Revoke
            </Button>
          )}
          <Link to={`/exhibitors/${row.slug || row._id}`}>
            <Button size="xs" variant="secondary" icon="eye">
              Profile
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  const active = tab === 'applications' ? applications : directory;
  const columns = tab === 'applications' ? applicationColumns : exhibitorColumns;

  return (
    <div>
      <PageHeader
        title="Exhibitors"
        subtitle="Review applications, assign booths during approval and manage exhibitor verification."
        icon="building"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'applications', label: 'Applications', icon: 'clipboard', count: applications.meta?.total },
            { value: 'directory', label: 'Exhibitor directory', icon: 'building', count: directory.meta?.total },
          ]}
        />
      </div>

      <FilterBar
        search={active.search}
        onSearch={active.setSearch}
        searchPlaceholder={tab === 'applications' ? 'Search applications by company…' : 'Search exhibitors…'}
        onReset={active.reset}
        filters={[
          ...(tab === 'applications'
            ? [
                {
                  name: 'status',
                  label: 'Status',
                  value: applications.filters.status || '',
                  options: APPLICATION_STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
                  onChange: (value) => applications.setFilter('status', value),
                },
                {
                  name: 'expo',
                  label: 'Expo',
                  value: applications.filters.expo || '',
                  options: (expos.data || []).map((expo) => ({ value: expo._id, label: expo.title })),
                  onChange: (value) => applications.setFilter('expo', value),
                },
              ]
            : [
                {
                  name: 'category',
                  label: 'Industry',
                  value: directory.filters.category || '',
                  options: COMPANY_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) })),
                  onChange: (value) => directory.setFilter('category', value),
                },
                {
                  name: 'minRating',
                  label: 'Rating',
                  value: directory.filters.minRating || '',
                  options: [
                    { value: '4', label: '4★ and up' },
                    { value: '3', label: '3★ and up' },
                  ],
                  onChange: (value) => directory.setFilter('minRating', value),
                },
              ]),
        ]}
      />

      <DataState loading={active.loading} error={active.error} onRetry={active.reload} skeleton={<TableSkeleton rows={8} columns={5} />}>
        <Table
          columns={columns}
          rows={active.items}
          empty={
            <EmptyState
              icon={tab === 'applications' ? 'clipboard' : 'building'}
              title={tab === 'applications' ? 'No applications to review' : 'No exhibitors yet'}
              message={tab === 'applications' ? 'New exhibitor applications land here for approval.' : 'Verified exhibitors appear in this directory.'}
            />
          }
        />
        <Pagination meta={active.meta} onPageChange={active.setPage} />
      </DataState>

      {/* ------------------------------------------------------ review modal */}
      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={`Review ${review?.exhibitor?.companyName || 'application'}`}
        subtitle={review?.expo?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>
              Cancel
            </Button>
            <Button
              icon="check"
              loading={busy}
              variant={reviewForm.status === 'rejected' ? 'danger' : 'primary'}
              onClick={submitReview}
            >
              Save decision
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Decision" required>
            <Select
              value={reviewForm.status}
              onChange={(event) => setReviewForm({ ...reviewForm, status: event.target.value })}
              options={[
                { value: 'approved', label: 'Approve application' },
                { value: 'under_review', label: 'Keep under review' },
                { value: 'rejected', label: 'Reject application' },
              ]}
            />
          </Field>

          {reviewForm.status === 'approved' && (
            <Field label="Assign a booth" hint="Optional — you can allocate a booth later from the Booths page.">
              <Select
                value={reviewForm.boothId}
                placeholder="No booth for now"
                options={(booths.data || []).map((booth) => ({
                  value: booth._id,
                  label: `${booth.zone}-${booth.number} · ${titleCase(booth.size)} · ${formatCurrency(booth.price, booth.currency)}`,
                }))}
                onChange={(event) => setReviewForm({ ...reviewForm, boothId: event.target.value })}
              />
            </Field>
          )}

          <Field label="Note to the exhibitor">
            <Textarea
              rows={3}
              value={reviewForm.reviewNote}
              onChange={(event) => setReviewForm({ ...reviewForm, reviewNote: event.target.value })}
              placeholder="Optional message included in the notification."
            />
          </Field>

          {review?.boothPreferences?.notes && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              Exhibitor notes: {review.boothPreferences.notes}
            </p>
          )}
        </div>
      </Modal>

      {/* ------------------------------------------------------ detail drawer */}
      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} title="Application detail">
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {detail.exhibitor?.logo ? (
                <img src={mediaUrl(detail.exhibitor.logo)} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                  <Icon name="building" className="h-6 w-6" />
                </span>
              )}
              <div>
                <p className="text-base font-semibold">{detail.exhibitor?.companyName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{detail.expo?.title}</p>
                <Badge className="mt-1" status={detail.status} dot />
              </div>
            </div>

            {detail.exhibitor?.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300">{truncate(detail.exhibitor.description, 400)}</p>
            )}

            <Card className="card-pad">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Requested size</dt>
                  <dd>{titleCase(detail.boothPreferences?.size || 'medium')}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Requested zone</dt>
                  <dd>{detail.boothPreferences?.zone || 'Any'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Submitted</dt>
                  <dd>{formatDate(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Assigned booth</dt>
                  <dd>{detail.assignedBooth ? `${detail.assignedBooth.zone}-${detail.assignedBooth.number}` : '—'}</dd>
                </div>
              </dl>
              {detail.specialRequests && (
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                  <span className="font-medium">Special requests:</span> {detail.specialRequests}
                </p>
              )}
            </Card>

            {detail.timeline?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Timeline</h3>
                <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4 dark:border-slate-700">
                  {detail.timeline.map((entry, index) => (
                    <li key={index} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                      <p className="text-sm font-medium">{titleCase(entry.status)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.note} · {formatDateTime(entry.at || entry.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {detail.productsToShowcase?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Products to showcase</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {detail.productsToShowcase.map((product, index) => (
                    <li key={index}>• {typeof product === 'string' ? product : product.name}</li>
                  ))}
                </ul>
              </div>
            )}

            <Link to={`/exhibitors/${detail.exhibitor?.slug || detail.exhibitor?._id}`} className="block">
              <Button variant="secondary" className="w-full" icon="eye">
                Open full profile
              </Button>
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AdminExhibitors;
