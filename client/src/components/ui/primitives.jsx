import { forwardRef } from 'react';
import { cn, initials, mediaUrl, statusTone, titleCase } from '../../lib/utils';
import Icon from './Icon';

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
};

const SIZES = { xs: 'btn-xs', sm: 'btn-sm', md: '', lg: 'px-5 py-3 text-base' };

export const Button = forwardRef(
  ({ variant = 'primary', size = 'md', loading = false, icon, iconRight, className, children, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(VARIANTS[variant] || VARIANTS.primary, SIZES[size], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} className="h-4 w-4" /> : null}
    </button>
  ),
);
Button.displayName = 'Button';

export const IconButton = ({ icon, label, className, size = 'md', ...rest }) => (
  <button type="button" aria-label={label} title={label} className={cn('btn-icon', size === 'sm' && 'h-8 w-8', className)} {...rest}>
    <Icon name={icon} className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
  </button>
);

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

export const Field = ({ label, htmlFor, error, hint, required, className, children }) => (
  <div className={className}>
    {label && (
      <label className="label" htmlFor={htmlFor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="field-error" role="alert">
        <Icon name="alert" className="h-3.5 w-3.5" /> {error}
      </p>
    ) : (
      hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    )}
  </div>
);

export const Input = forwardRef(({ className, error, icon, ...rest }, ref) => (
  <div className="relative">
    {icon && <Icon name={icon} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
    <input ref={ref} className={cn('input', icon && 'pl-9', error && 'input-error', className)} {...rest} />
  </div>
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, error, rows = 4, ...rest }, ref) => (
  <textarea ref={ref} rows={rows} className={cn('input resize-y', error && 'input-error', className)} {...rest} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ className, error, options = [], placeholder, children, ...rest }, ref) => (
  <select ref={ref} className={cn('input pr-9', error && 'input-error', className)} {...rest}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((option) => {
      const value = typeof option === 'string' ? option : option.value;
      const label = typeof option === 'string' ? titleCase(option) : option.label;
      return (
        <option key={value} value={value}>
          {label}
        </option>
      );
    })}
    {children}
  </select>
));
Select.displayName = 'Select';

export const Checkbox = ({ label, className, ...rest }) => (
  <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200', className)}>
    <input type="checkbox" className="checkbox" {...rest} />
    {label}
  </label>
);

export const Toggle = ({ checked, onChange, label, description, disabled }) => (
  <label className={cn('flex cursor-pointer items-start justify-between gap-4', disabled && 'opacity-60')}>
    <span>
      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
      {description && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition',
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  </label>
);

export const FormError = ({ errors, className }) => {
  if (!errors) return null;
  const messages = Array.isArray(errors) ? errors : [errors];
  if (!messages.length) return null;
  return (
    <div className={cn('rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200', className)}>
      {messages.map((message, index) => (
        <p key={index} className="flex items-start gap-2">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{typeof message === 'string' ? message : message.message}</span>
        </p>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const Card = ({ as: Component = 'div', className, hover = false, children, ...rest }) => (
  <Component className={cn('card', hover && 'card-hover', className)} {...rest}>
    {children}
  </Component>
);

export const CardHeader = ({ title, subtitle, action, className, icon }) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800', className)}>
    <div className="flex items-start gap-3">
      {icon && (
        <span className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const Badge = ({ tone, status, children, className, dot = false }) => {
  const resolved = tone || statusTone(status) || 'neutral';
  return (
    <span className={cn(`badge-${resolved}`, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children ?? titleCase(status)}
    </span>
  );
};

export const Spinner = ({ size = 'md', className }) => {
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-9 w-9 border-[3px]' };
  return <span className={cn('inline-block animate-spin rounded-full border-current border-r-transparent', sizes[size], className)} />;
};

export const Skeleton = ({ className }) => <div className={cn('skeleton', className)} />;

export const SkeletonCard = ({ rows = 3 }) => (
  <div className="card card-pad space-y-3">
    <Skeleton className="h-5 w-1/3" />
    {Array.from({ length: rows }).map((_, index) => (
      <Skeleton key={index} className="h-4 w-full" />
    ))}
  </div>
);

export const Avatar = ({ src, name, size = 'md', className, online }) => {
  const sizes = { xs: 'h-7 w-7 text-[10px]', sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' };
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={mediaUrl(src)}
          alt={name || 'Avatar'}
          className={cn('rounded-full object-cover ring-2 ring-white dark:ring-slate-900', sizes[size])}
          loading="lazy"
        />
      ) : (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300',
            sizes[size],
          )}
        >
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900',
            online ? 'bg-emerald-500' : 'bg-slate-400',
          )}
          title={online ? 'Online' : 'Offline'}
        />
      )}
    </span>
  );
};

export const ProgressBar = ({ value = 0, max = 100, tone = 'brand', className, showLabel = false }) => {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tones = { brand: 'bg-brand-600', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500' };
  return (
    <div className={className}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${percent}%` }} />
      </div>
      {showLabel && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{percent}%</p>}
    </div>
  );
};

export const StarRating = ({ value = 0, count, onChange, size = 'md', className, showValue = true }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };
  const interactive = typeof onChange === 'function';
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={interactive ? () => onChange(star) : undefined}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            className={cn(interactive ? 'cursor-pointer transition hover:scale-110' : 'cursor-default', 'p-0.5')}
          >
            <Icon
              name="star"
              filled={star <= Math.round(value)}
              className={cn(sizes[size], star <= Math.round(value) ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600')}
              strokeWidth={1.4}
            />
          </button>
        ))}
      </span>
      {showValue && value > 0 && <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{Number(value).toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-slate-500 dark:text-slate-400">({count})</span>}
    </span>
  );
};

export const StatCard = ({ label, value, hint, icon, tone = 'brand', trend, className }) => {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
    danger: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
    info: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300',
  };
  return (
    <Card className={cn('card-pad', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1.5 truncate">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
        {icon && <span className={cn('rounded-2xl p-3', tones[tone])}>{<Icon name={icon} className="h-5 w-5" />}</span>}
      </div>
      {trend !== undefined && trend !== null && (
        <p className={cn('mt-3 inline-flex items-center gap-1 text-xs font-semibold', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          <Icon name="chart" className="h-3.5 w-3.5" />
          {trend >= 0 ? '+' : ''}
          {trend}% vs last period
        </p>
      )}
    </Card>
  );
};

export const Tabs = ({ tabs = [], active, onChange, className, size = 'md' }) => (
  <div className={cn('flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70', className)} role="tablist">
    {tabs.map((tab) => {
      const isActive = active === tab.value;
      return (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange?.(tab.value)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg font-medium transition',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
            isActive
              ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
          )}
        >
          {tab.icon && <Icon name={tab.icon} className="h-4 w-4" />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const DefinitionItem = ({ label, children, className }) => (
  <div className={className}>
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{children ?? '—'}</dd>
  </div>
);
