import { Link, Outlet } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import Logo from '../components/common/Logo';
import ThemeToggle from '../components/common/ThemeToggle';

const HIGHLIGHTS = [
  { icon: 'map', title: 'Interactive floor plans', text: 'Reserve a booth, locate an exhibitor, scan a pass.' },
  { icon: 'chat', title: 'Real-time everything', text: 'Live chat, notifications and booth updates over Socket.IO.' },
  { icon: 'sparkles', title: 'AI event assistant', text: 'Ask about sessions, booths and exhibitors grounded in your data.' },
];

const AuthLayout = () => (
  <div className="flex min-h-full flex-col lg:flex-row">
    <aside className="relative hidden flex-1 overflow-hidden gradient-brand px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="relative z-10">
        <Logo tone="invert" />
        <h2 className="mt-14 max-w-md text-3xl font-bold leading-tight">
          One platform for organizers, exhibitors and attendees.
        </h2>
        <p className="mt-4 max-w-md text-sm text-white/80">
          Plan expos, approve exhibitors, allocate booths, run sessions, take payments and keep the whole event in sync.
        </p>
        <ul className="mt-10 space-y-5">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="rounded-xl bg-white/15 p-2">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="block text-sm text-white/75">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative z-10 text-xs text-white/70">
        Demo credentials are listed on the sign-in form — use them to explore every role instantly.
      </p>
      <span className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
      <span className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10" />
    </aside>

    <div className="flex flex-1 flex-col px-4 py-8 sm:px-8 lg:px-14">
      <div className="flex items-center justify-between">
        <div className="lg:hidden">
          <Logo />
        </div>
        <Link to="/" className="btn-ghost btn-sm ml-auto">
          <Icon name="chevron-left" className="h-4 w-4" /> Back to site
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  </div>
);

export default AuthLayout;
