import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { cn, relativeTime, truncate } from '../../lib/utils';
import Icon from '../ui/Icon';
import { Dropdown } from '../ui/overlay';
import { Button } from '../ui/primitives';

const NotificationBell = () => {
  const { unread, notifications, markRead, markAllRead } = useNotifications();
  const { role } = useAuth();

  const inboxPath = role ? `/${role}/notifications` : '/notifications';

  return (
    <Dropdown
      align="right"
      className="w-[340px] max-w-[92vw] p-0"
      trigger={
        <button type="button" className="btn-icon relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Icon name="bell" className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="text-sm font-semibold">Notifications</p>
        {unread > 0 && (
          <button type="button" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className="scroll-area max-h-[320px]">
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">You are all caught up 🎉</p>
        ) : (
          notifications.slice(0, 8).map((notification) => (
            <button
              key={notification._id}
              type="button"
              onClick={() => !notification.read && markRead([notification._id])}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60',
                !notification.read && 'bg-brand-50/50 dark:bg-brand-950/30',
              )}
            >
              <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', notification.read ? 'bg-slate-300 dark:bg-slate-700' : 'bg-brand-500')} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{notification.title}</span>
                {notification.body && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{truncate(notification.body, 90)}</span>}
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-slate-400">{relativeTime(notification.createdAt)}</span>
              </span>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-slate-100 p-2 dark:border-slate-800">
        <Link to={inboxPath} className="block">
          <Button variant="ghost" size="sm" className="w-full">
            View all notifications
          </Button>
        </Link>
      </div>
    </Dropdown>
  );
};

export default NotificationBell;
