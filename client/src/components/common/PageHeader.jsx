import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import { cn } from '../../lib/utils';

const PageHeader = ({ title, subtitle, breadcrumbs = [], actions, children, className, icon }) => (
  <header className={cn('mb-6', className)}>
    {breadcrumbs.length > 0 && (
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
            {crumb.to ? (
              <Link to={crumb.to} className="hover:text-brand-600 dark:hover:text-brand-300">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-slate-600 dark:text-slate-300">{crumb.label}</span>
            )}
            {index < breadcrumbs.length - 1 && <Icon name="chevron-right" className="h-3 w-3" />}
          </span>
        ))}
      </nav>
    )}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="hidden rounded-2xl bg-brand-50 p-3 text-brand-600 sm:inline-flex dark:bg-brand-950 dark:text-brand-300">
            <Icon name={icon} className="h-6 w-6" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {children}
  </header>
);

export default PageHeader;
