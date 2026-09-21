import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { cn, relativeTime, titleCase } from '../../lib/utils';
import Icon from '../../components/ui/Icon';
import { Button, Spinner, Tabs } from '../../components/ui';
import { EmptyState } from '../../components/ui/data';
import PageHeader from '../../components/common/PageHeader';

const TYPE_ICONS = {
  expo_registration: 'ticket',
  exhibitor_approved: 'check',
  exhibitor_rejected: 'alert',
  booth_assigned: 'map',
  booth_booked: 'map',
  payment: 'credit-card',
  session_reminder: 'clock',
  session_cancelled: 'alert',
  schedule_changed: 'calendar',
  appointment_requested: 'handshake',
  appointment_confirmed: 'check',
  new_message: 'chat',
  announcement: 'megaphone',
  system: 'info',
};

const NotificationsPage = () => {
  const { notifications, unread, loading, markRead, markAllRead, dismiss, clearRead, load } = useNotifications();
  const toast = useToast();
  const [tab, setTab] = useState('all');

  const visible = useMemo(() => (tab === 'unread' ? notifications.filter((item) => !item.read) : notifications), [notifications, tab]);

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Could not update notifications');
    }
  };

  const handleClear = async () => {
    try {
      await clearRead();
      toast.success('Read notifications cleared');
    } catch {
      toast.error('Could not clear notifications');
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Approvals, booth assignments, payments, reminders and announcements — delivered in real time."
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={() => load({ limit: 30 })}>
              Refresh
            </Button>
            {unread > 0 && (
              <Button icon="check" onClick={handleMarkAll}>
                Mark all read
              </Button>
            )}
            <Button variant="ghost" icon="trash" onClick={handleClear}>
              Clear read
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All', count: notifications.length },
            { value: 'unread', label: 'Unread', count: unread },
          ]}
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">{unread} unread</p>
      </div>

      {loading && !notifications.length ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Spinner size="lg" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="bell"
          title={tab === 'unread' ? 'No unread notifications' : 'Nothing here yet'}
          message="You will be notified about approvals, bookings, payments and reminders as they happen."
        />
      ) : (
        <ul className="space-y-2.5">
          {visible.map((notification) => (
            <li
              key={notification._id}
              className={cn(
                'card flex items-start gap-3.5 p-4',
                !notification.read && 'border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/30',
              )}
            >
              <span className={cn('rounded-xl p-2.5', notification.read ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300')}>
                <Icon name={TYPE_ICONS[notification.type] || 'bell'} className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  {notification.priority === 'high' && <span className="badge-danger text-[10px]">High priority</span>}
                  <span className="badge-neutral text-[10px]">{titleCase(notification.type)}</span>
                </div>
                {notification.body && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.body}</p>}
                <p className="mt-1.5 text-xs text-slate-400">{relativeTime(notification.createdAt)}</p>
                {notification.link && (
                  <Link to={notification.link} className="link mt-1 inline-block text-xs">
                    Open
                  </Link>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {!notification.read && (
                  <Button size="xs" variant="secondary" onClick={() => markRead([notification._id])}>
                    Mark read
                  </Button>
                )}
                <button
                  type="button"
                  className="btn-icon h-8 w-8"
                  title="Delete notification"
                  aria-label="Delete notification"
                  onClick={() => dismiss(notification._id)}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationsPage;
