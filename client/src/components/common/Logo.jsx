import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

const Logo = ({ to = '/', compact = false, className, tone = 'default' }) => (
  <Link to={to} className={cn('inline-flex items-center gap-2.5', className)} aria-label="EventSphere home">
    <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white shadow-sm">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M4.6 7.5l2.6 1.5M16.8 15l2.6 1.5M4.6 16.5l2.6-1.5M16.8 9l2.6-1.5" />
      </svg>
    </span>
    {!compact && (
      <span className="leading-tight">
        <span className={cn('block text-base font-bold tracking-tight', tone === 'invert' ? 'text-white' : 'text-slate-900 dark:text-white')}>
          EventSphere
        </span>
        <span className={cn('block text-[10px] font-semibold uppercase tracking-[0.16em]', tone === 'invert' ? 'text-white/70' : 'text-slate-500 dark:text-slate-400')}>
          Expo &amp; Event Platform
        </span>
      </span>
    )}
  </Link>
);

export default Logo;
