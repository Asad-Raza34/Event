import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { COMPANY_CATEGORIES } from '../../lib/constants';
import { mediaUrl, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Select, StarRating } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const ExhibitorsPage = () => {
  const list = useListQuery((query) => api.exhibitors.directory(query), { limit: 12 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Exhibitor directory"
        subtitle="Explore every company showcasing at EventSphere, their products, ratings and booth locations."
        icon="building"
        actions={
          <Link to="/expos">
            <Button variant="secondary" icon="calendar">
              Browse expos
            </Button>
          </Link>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by company, description or category…"
        onReset={list.reset}
        filters={[
          {
            name: 'category',
            label: 'Industry',
            value: list.filters.category || '',
            options: COMPANY_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) })),
            onChange: (value) => list.setFilter('category', value),
          },
          {
            name: 'minRating',
            label: 'Minimum rating',
            value: list.filters.minRating || '',
            options: [
              { value: '4', label: '4★ and up' },
              { value: '3', label: '3★ and up' },
              { value: '2', label: '2★ and up' },
            ],
            onChange: (value) => list.setFilter('minRating', value),
          },
        ]}
        right={
          <div className="w-[170px]">
            <label className="label" htmlFor="exhibitor-sort">
              Sort by
            </label>
            <Select
              id="exhibitor-sort"
              value={list.filters.sort || ''}
              placeholder="Featured"
              options={[{ value: 'rating', label: 'Highest rated' }]}
              onChange={(event) => list.setFilter('sort', event.target.value)}
            />
          </div>
        }
      />

      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon="building"
          title="No exhibitors match your filters"
          message="Try a different industry or clear the search to see the full directory."
          action={
            <Button variant="secondary" icon="refresh" onClick={list.reset}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{list.meta?.total ?? list.items.length} exhibitors</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((exhibitor) => (
              <Card key={exhibitor._id} hover className="flex flex-col p-5">
                <div className="flex items-start gap-4">
                  {exhibitor.logo ? (
                    <img src={mediaUrl(exhibitor.logo)} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                      <Icon name="building" className="h-6 w-6" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold">{exhibitor.companyName}</h2>
                    {exhibitor.tagline && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{exhibitor.tagline}</p>}
                    <StarRating value={exhibitor.avgRating || 0} count={exhibitor.reviewCount || 0} size="sm" className="mt-1.5" />
                  </div>
                  {exhibitor.verificationStatus === 'verified' && <Badge tone="success">Verified</Badge>}
                </div>

                <p className="mt-3 flex-1 text-sm text-slate-500 dark:text-slate-400">{truncate(exhibitor.description || '', 130)}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(exhibitor.categories || []).slice(0, 3).map((category) => (
                    <span key={category} className="badge-neutral text-[11px]">
                      {titleCase(category)}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {exhibitor.contact?.city || exhibitor.contact?.country || 'Location on request'}
                  </span>
                  <Link to={`/exhibitors/${exhibitor.slug || exhibitor._id}`}>
                    <Button size="sm" icon="chevron-right">
                      View profile
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        </>
      )}
    </div>
  );
};

export default ExhibitorsPage;
