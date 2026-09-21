import { cn } from '../../lib/utils';
import Icon from '../ui/Icon';
import { Input, Select } from '../ui';

const FilterBar = ({ search, onSearch, searchPlaceholder = 'Search…', filters = [], onReset, children, className, right }) => {
  const hasFilters = filters.length > 0;

  return (
    <div className={cn('card card-pad mb-5', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {onSearch && (
          <div className="flex-1">
            <label className="label" htmlFor="filter-search">
              Search
            </label>
            <Input
              id="filter-search"
              icon="search"
              value={search}
              placeholder={searchPlaceholder}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
        )}

        {hasFilters && (
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-none lg:auto-cols-min lg:grid-flow-col">
            {filters.map((filter) => (
              <div key={filter.name} className="min-w-[140px]">
                <label className="label" htmlFor={`filter-${filter.name}`}>
                  {filter.label}
                </label>
                <Select
                  id={`filter-${filter.name}`}
                  value={filter.value}
                  placeholder={filter.placeholder || 'All'}
                  options={filter.options}
                  onChange={(event) => filter.onChange(event.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {children}
          {onReset && (
            <button type="button" className="btn-ghost btn-sm" onClick={onReset}>
              <Icon name="refresh" className="h-4 w-4" /> Reset
            </button>
          )}
          {right}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
