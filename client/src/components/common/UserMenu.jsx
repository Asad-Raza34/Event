import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { initials } from '../../lib/utils';
import { ROLES } from '../../lib/constants';
import Icon from '../ui/Icon';
import { Dropdown, DropdownItem } from '../ui/overlay';

const UserMenu = () => {
  const { user, logout, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  if (!user) return null;

  const settingsPath = role === ROLES.ADMIN ? '/admin/settings' : role === ROLES.EXHIBITOR ? '/exhibitor/settings' : '/attendee/profile';

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  return (
    <Dropdown
      align="right"
      className="w-64"
      trigger={
        <button type="button" className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition hover:bg-slate-200/60 dark:hover:bg-slate-800">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {initials(user.name)}
            </span>
          )}
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold leading-tight">{user.name}</span>
            <span className="block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{user.role}</span>
          </span>
          <Icon name="chevron-down" className="hidden h-4 w-4 text-slate-400 sm:block" />
        </button>
      }
    >
      <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-800">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
      </div>
      <DropdownItem icon="user-cog" onClick={() => navigate(settingsPath)}>
        Profile &amp; settings
      </DropdownItem>
      <DropdownItem icon={isDark ? 'sun' : 'moon'} onClick={toggleTheme}>
        Switch to {isDark ? 'light' : 'dark'} mode
      </DropdownItem>
      {role === ROLES.EXHIBITOR && (
        <DropdownItem icon="building" onClick={() => navigate('/exhibitor/company')}>
          Company profile
        </DropdownItem>
      )}
      {role === ROLES.ATTENDEE && (
        <DropdownItem icon="qr" onClick={() => navigate('/attendee/pass')}>
          Event pass
        </DropdownItem>
      )}
      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
      <DropdownItem icon="logout" tone="danger" onClick={handleLogout}>
        Sign out
      </DropdownItem>
    </Dropdown>
  );
};

export default UserMenu;
