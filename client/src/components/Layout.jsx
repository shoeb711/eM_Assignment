// App shell: sidebar navigation (top bar on mobile) + signed-in user + page content.
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import { activityApi } from '../api/endpoints.js';
import { useLookups } from '../hooks/useLookups.js';
import { formatDate, humanize } from '../utils/format.js';

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { reportingDate } = useLookups();
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: activityApi.notifications });
  const unread = notifications.data?.unread || 0;

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/projects', label: 'Projects' },
    { to: '/tasks', label: 'Tasks' },
    { to: '/change-requests', label: 'Change requests' },
    { to: '/costs', label: 'Costs' },
    { to: '/notifications', label: 'Notifications', badge: unread },
    ...(isAdmin ? [{ to: '/audit', label: 'Audit & automation' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="border-b border-slate-200 bg-slate-900 text-slate-200 md:fixed md:inset-y-0 md:w-56 md:border-b-0">
        <div className="px-4 py-4">
          <p className="text-sm font-semibold text-white">PMO Portfolio Portal</p>
          <p className="text-xs text-slate-400">eMinds Assignment</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              {link.label}
              {link.badge > 0 && <span className="ml-2 rounded-full bg-indigo-500 px-1.5 text-xs text-white">{link.badge}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 md:ml-56">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 md:px-6">
          <p className="text-xs text-slate-500">
            KPIs as of <span className="font-medium text-slate-700">{formatDate(reportingDate)}</span> (reporting snapshot)
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-700">{user.full_name}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{humanize(user.role)}</span>
            <button type="button" onClick={logout} className="text-indigo-700 hover:underline">Sign out</button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
