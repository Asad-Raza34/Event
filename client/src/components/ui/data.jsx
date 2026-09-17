import { cn } from '../../lib/utils';
import Icon from './Icon';
import { Button, Skeleton } from './primitives';

export const Table = ({ columns = [], rows = [], keyField = '_id', onRowClick, empty, className, dense = false }) => {
  if (!rows.length && empty) return empty;

  return (
    <div className={cn('table-wrap', className)}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : undefined} style={column.width ? { width: column.width } : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row[keyField] || index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer' : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(dense && 'py-2', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center', column.className)}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Pagination = ({ meta, onPageChange, className }) => {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = [];
  const window = 2;
  for (let index = Math.max(1, page - window); index <= Math.min(totalPages, page + window); index += 1) pages.push(index);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 pt-4', className)}>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{from}</span>–
        <span className="font-semibold text-slate-700 dark:text-slate-200">{to}</span> of{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={!meta.hasPrevPage}
          onClick={() => onPageChange?.(page - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevron-left" className="h-3.5 w-3.5" /> Prev
        </button>
        {pages[0] > 1 && <span className="px-1 text-slate-400">…</span>}
        {pages.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPageChange?.(value)}
            className={cn('h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition', value === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800')}
          >
            {value}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && <span className="px-1 text-slate-400">…</span>}
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange?.(page + 1)}
          aria-label="Next page"
        >
          Next <Icon name="chevron-right" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export const EmptyState = ({ icon = 'search', title = 'Nothing here yet', message, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700', className)}>
    <span className="rounded-2xl bg-slate-100 p-3.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <Icon name={icon} className="h-6 w-6" />
    </span>
    <h3 className="mt-4 text-base font-semibold">{title}</h3>
    {message && <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ error, onRetry, className }) => (
  <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-10 text-center dark:border-rose-900 dark:bg-rose-950/40', className)}>
    <span className="rounded-2xl bg-rose-100 p-3 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
      <Icon name="alert" className="h-6 w-6" />
    </span>
    <h3 className="mt-4 text-base font-semibold text-rose-900 dark:text-rose-100">
      {error?.isNetworkError ? 'Cannot reach the server' : 'Something went wrong'}
    </h3>
    <p className="mt-1.5 max-w-md text-sm text-rose-700 dark:text-rose-300">{error?.message || 'An unexpected error occurred.'}</p>
    {onRetry && (
      <Button variant="secondary" className="mt-5" icon="refresh" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export const LoadingState = ({ rows = 3, className }) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="card flex items-center gap-4 p-5">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="table-wrap">
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Renders the right state for a fetched resource. */
export const DataState = ({ loading, error, empty, onRetry, children, skeleton }) => {
  if (loading) return skeleton || <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (empty) return empty;
  return children;
};
