import { Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useListQuery } from '../../hooks/useListQuery';
import { EXPO_CATEGORIES, EXPO_STATUSES } from '../../lib/constants';
import { formatCurrency, formatDate, mediaUrl, titleCase, truncate } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Badge, Button, Card, Select } from '../../components/ui';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';

const SORTS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'startDate', label: 'Starting soonest' },
  { value: '-stats.registeredCount', label: 'Most popular' },
  { value: 'title', label: 'A → Z' },
];

const ExposPage = () => {
  const [params, setParams] = useSearchParams();
  const list = useListQuery((query) => api.expos.list(query), {
    limit: 9,
    initialFilters: {
      status: params.get('status') || 'upcoming,ongoing',
      category: params.get('category') || undefined,
      city: params.get('city') || undefined,
      sort: 'startDate',
    },
  });

  const syncUrl = (next) => {
    const merged = { ...list.filters, ...next };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value && key !== 'sort') search.set(key, value);
    });
    setParams(search, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Browse expos"
        subtitle="Search the full catalogue of expos, conferences and trade shows — filter by category, city and status."
        icon="compass"
        actions={
          <Link to="/schedule">
            <Button variant="secondary" icon="clock">
              View full schedule
            </Button>
          </Link>
        }
      />

      <FilterBar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Search by title, description, venue or city…"
        onReset={() => {
          list.reset();
          setParams(new URLSearchParams(), { replace: true });
        }}
        filters={[
          {
            name: 'status',
            label: 'Status',
            value: list.filters.status || '',
            options: EXPO_STATUSES.map((status) => ({ value: status, label: titleCase(status) })),
            onChange: (value) => {
              list.setFilter('status', value);
              syncUrl({ status: value });
            },
          },
          {
            name: 'category',
            label: 'Category',
            value: list.filters.category || '',
            options: EXPO_CATEGORIES.map((category) => ({ value: category, label: titleCase(category) })),
            onChange: (value) => {
              list.setFilter('category', value);
              syncUrl({ category: value });
            },
          },
        ]}
        right={
          <div className="w-[180px]">
            <label className="label" htmlFor="expo-sort">
              Sort by
            </label>
            <Select
              id="expo-sort"
              value={list.filters.sort || 'startDate'}
              options={SORTS}
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
          icon="calendar"
          title="No expos match your filters"
          message="Try clearing the search or picking a different category — new events are published regularly."
          action={
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => {
                list.reset();
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {list.meta?.total ?? list.items.length} expos found
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((expo) => (
              <Card key={expo._id} hover className="flex flex-col overflow-hidden">
                <div className="relative h-40 overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {expo.banner ? (
                    <img src={mediaUrl(expo.banner)} alt={expo.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-slate-400">
                      <Icon name="calendar" className="h-8 w-8" />
                    </span>
                  )}
                  <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <Badge status={expo.status} dot />
                    {expo.isFeatured && <Badge tone="info">Featured</Badge>}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{titleCase(expo.category)}</p>
                  <h2 className="mt-1.5 text-base font-semibold">{expo.title}</h2>
                  <p className="mt-1.5 flex-1 text-sm text-slate-500 dark:text-slate-400">{truncate(expo.description || '', 120)}</p>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <p className="flex items-center gap-1.5">
                      <Icon name="calendar" className="h-3.5 w-3.5" /> {formatDate(expo.startDate)} – {formatDate(expo.endDate)}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Icon name="location" className="h-3.5 w-3.5" /> {expo.location?.venue || 'Venue TBA'}
                      {expo.location?.city ? `, ${expo.location.city}` : ''}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Icon name="users" className="h-3.5 w-3.5" /> {expo.stats?.registeredCount || 0} registered
                      {expo.maxAttendees ? ` of ${expo.maxAttendees}` : ''}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">
                      {expo.ticketPrice > 0 ? formatCurrency(expo.ticketPrice, expo.currency) : 'Free entry'}
                    </span>
                    <Link to={`/expos/${expo.slug || expo._id}`}>
                      <Button size="sm" icon="chevron-right">
                        View expo
                      </Button>
                    </Link>
                  </div>
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

export default ExposPage;
