import { useCallback, useMemo, useState } from 'react';
import { useApi } from './useApi';
import { useDebounce } from './useDebounce';

/**
 * List + search + filter + pagination in one hook.
 *
 *   const list = useListQuery((query) => api.expos.list(query), { initialFilters: { status: 'upcoming' } });
 *   list.items  // rows
 *   list.meta   // { total, page, totalPages, … } from the API envelope
 */
export const useListQuery = (fetcher, { initialFilters = {}, limit = 12, searchKey = 'q', enabled = true, deps = [] } = {}) => {
  const [page, setPageState] = useState(1);
  const [search, setSearchState] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const debouncedSearch = useDebounce(search, 350);

  const query = useMemo(() => {
    const merged = { page, limit, ...filters };
    if (debouncedSearch.trim()) merged[searchKey] = debouncedSearch.trim();
    Object.keys(merged).forEach((key) => {
      if (merged[key] === '' || merged[key] === undefined || merged[key] === null) delete merged[key];
    });
    return merged;
  }, [page, limit, filters, debouncedSearch, searchKey]);

  const serialized = JSON.stringify(query);
  const { data, meta, loading, error, reload, setData } = useApi(
    () => fetcher(JSON.parse(serialized)),
    [serialized, ...deps],
    { enabled },
  );

  const setPage = useCallback((next) => setPageState(Math.max(1, next)), []);
  const setSearch = useCallback((value) => {
    setSearchState(value);
    setPageState(1);
  }, []);
  const setFilter = useCallback((name, value) => {
    setFilters((current) => ({ ...current, [name]: value || undefined }));
    setPageState(1);
  }, []);
  const patchFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPageState(1);
  }, []);
  const reset = useCallback(() => {
    setFilters(initialFilters);
    setSearchState('');
    setPageState(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialFilters)]);

  return {
    items: Array.isArray(data) ? data : [],
    payload: data,
    meta,
    loading,
    error,
    reload,
    setData,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilter,
    patchFilters,
    reset,
    query,
  };
};

export default useListQuery;
