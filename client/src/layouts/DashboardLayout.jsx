import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useSocket } from '../context/SocketContext';
import { NAVIGATION } from '../lib/constants';
import { cn, initials } from '../lib/utils';
import Icon from '../components/ui/Icon';
import ThemeToggle from '../components/common/ThemeToggle';
import UserMenu from '../components/common/UserMenu';
import NotificationBell from '../components/common/NotificationBell';
import GlobalSearch from '../components/common/GlobalSearch';

const SIDEBAR_KEY = 'eventsphere-sidebar-collapsed';

const SidebarNav = ({ role, onNavigate, unreadNotifications }) => {
  const groups = NAVIGATION[role] || [];
  const items = groups.reduce((acc, entry) => {
    if (entry.section) {
      acc.push({ section: entry.section, links: [] });
      return acc;
    }
    if (!acc.length) acc.push({ section: '', links: [] });
    acc[acc.length - 1].links.push(entry);
    return acc;
  }, []);

  return (
    <nav className="flex flex-col gap-5" aria-label="Dashboard">
      {items.map((group, index) => (
        <div key={`${group.section}-${index}`}>
          {group.section && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {group.section}
            </p>
          )}
          <div className="space-y-0.5">
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={onNavigate}
                className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}
              >
                <Icon name={link.icon} className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{link.label}</span>
                {link.label === 'Notifications' && unreadNotifications > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
};

const DashboardLayout = () => {
  const { role, user, homeRoute } = useAuth();
  const { unread } = useNotifications();
  const { connected } = useSocket();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

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

  const activeLabel =
    (NAVIGATION[role] || []).find((entry) => entry.to && entry.to !== homeRoute && location.pathname.startsWith(entry.to))?.label ||
    (location.pathname === homeRoute ? 'Dashboard' : '');

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ------------------------------------------------ desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200/80 bg-white transition-all lg:flex dark:border-slate-800 dark:bg-slate-900',
          collapsed ? 'w-[76px]' : 'w-[268px]',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-slate-200/80 dark:border-slate-800', collapsed ? 'justify-center px-2' : 'px-4')}>
          <Link to={homeRoute} className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white">
              <Icon name="spark" className="h-5 w-5" />
            </span>
            {!collapsed && (
              <span className="leading-tight">
                <span className="block text-sm font-bold tracking-tight">EventSphere</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {role} workspace
                </span>
              </span>
            )}
          </Link>
        </div>

        <div className="scroll-area flex-1 px-3 py-4">
          {collapsed ? (
            <nav className="flex flex-col items-center gap-1.5">
              {(NAVIGATION[role] || [])
                .filter((entry) => entry.to)
                .map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    title={link.label}
                    className={({ isActive }) => cn('btn-icon', isActive && 'bg-brand-600 text-white hover:bg-brand-600 hover:text-white')}
                  >
                    <Icon name={link.icon} className="h-[18px] w-[18px]" />
                  </NavLink>
                ))}
            </nav>
          ) : (
            <SidebarNav role={role} unreadNotifications={unread} />
          )}
        </div>

        <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="sidebar-link w-full">
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} className="h-[18px] w-[18px]" />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------ mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative z-10 flex h-full w-[272px] animate-slide-in flex-col bg-white dark:bg-slate-900">
            <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
              <span className="text-sm font-bold">EventSphere</span>
              <button type="button" className="btn-icon" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <div className="scroll-area flex-1 px-3 py-4">
              <SidebarNav role={role} onNavigate={() => setDrawerOpen(false)} unreadNotifications={unread} />
            </div>
            <div className="border-t border-slate-200/80 p-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {initials(user?.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------- content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 glass px-4 dark:border-slate-800 sm:px-6">
          <button type="button" className="btn-icon lg:hidden" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{activeLabel || 'Dashboard'}</p>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              {connected ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live updates connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Offline — data still loads on refresh
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 md:flex"
          >
            <Icon name="search" className="h-4 w-4" />
            <span>Search</span>
            <span className="kbd">⌘K</span>
          </button>

          <Link to="/" className="btn-icon hidden sm:inline-flex" title="View public site" aria-label="View public site">
            <Icon name="globe" className="h-5 w-5" />
          </Link>
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200/80 px-4 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-6">
          EventSphere Management System · {new Date().getFullYear()}
        </footer>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
