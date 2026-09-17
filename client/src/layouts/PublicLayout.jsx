import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Icon from '../components/ui/Icon';
import { Button } from '../components/ui';
import Logo from '../components/common/Logo';
import ThemeToggle from '../components/common/ThemeToggle';
import UserMenu from '../components/common/UserMenu';
import NotificationBell from '../components/common/NotificationBell';
import GlobalSearch from '../components/common/GlobalSearch';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/expos', label: 'Expos' },
  { to: '/exhibitors', label: 'Exhibitors' },
  { to: '/schedule', label: 'Schedule' },
];

const PublicLayout = () => {
  const { isAuthenticated, homeRoute, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@eventsphere.io';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 glass dark:border-slate-800">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => cn('nav-link', isActive && 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white')}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 sm:flex"
            >
              <Icon name="search" className="h-4 w-4" />
              <span className="hidden md:inline">Search everything</span>
              <span className="kbd hidden md:inline">⌘K</span>
            </button>
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <NotificationBell />
                <UserMenu />
                <Link to={homeRoute} className="hidden lg:block">
                  <Button size="sm" icon="grid">
                    Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" icon="spark">
                    Get started
                  </Button>
                </Link>
              </div>
            )}
            <button type="button" className="btn-icon lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen((open) => !open)}>
              <Icon name={menuOpen ? 'x' : 'menu'} className="h-5 w-5" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200/70 bg-white px-4 py-3 lg:hidden dark:border-slate-800 dark:bg-slate-950">
            <nav className="flex flex-col gap-1">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              {isAuthenticated ? (
                <Link to={homeRoute}>
                  <Button className="w-full" icon="grid">
                    Go to dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="secondary" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="w-full" icon="spark">
                      Create an account
                    </Button>
                  </Link>
                </>
              )}
              {user && (
                <p className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
                  Signed in as <span className="font-semibold">{user.email}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-md text-sm text-slate-500 dark:text-slate-400">
              The complete expo and event management platform: organizer dashboards, exhibitor booth management, attendee
              experiences, live chat, QR passes and an AI event assistant — all in one place.
            </p>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Need help? <a className="link" href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Discover</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><Link className="hover:text-brand-600 dark:hover:text-brand-300" to="/expos">Browse expos</Link></li>
              <li><Link className="hover:text-brand-600 dark:hover:text-brand-300" to="/exhibitors">Exhibitor directory</Link></li>
              <li><Link className="hover:text-brand-600 dark:hover:text-brand-300" to="/schedule">Full schedule</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Platform</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><Link className="hover:text-brand-600 dark:hover:text-brand-300" to="/login">Sign in</Link></li>
              <li><Link className="hover:text-brand-600 dark:hover:text-brand-300" to="/register">Create account</Link></li>
              <li><Link className="hover:text-brand-600 dark:hover:text-brand-300" to="/attendee/pass">Event pass</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200/70 py-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          © {new Date().getFullYear()} EventSphere Management System. Built with the MERN stack.
        </div>
      </footer>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default PublicLayout;
