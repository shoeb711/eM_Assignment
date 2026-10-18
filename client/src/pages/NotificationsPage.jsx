// In-app notifications created by the automation (e.g. overdue task alerts).
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../api/endpoints.js';
import { useApiMutation } from '../hooks/useApiMutation.js';
import { Button, Card, EmptyState, PageHeader, QueryState } from '../components/ui.jsx';
import { formatDateTime, humanize } from '../utils/format.js';

export function NotificationsPage() {
  const query = useQuery({ queryKey: ['notifications'], queryFn: activityApi.notifications });
  const markRead = useApiMutation((id) => activityApi.markRead(id), { invalidate: ['notifications'] });

  return (
    <>
      <PageHeader title="Notifications" subtitle="Alerts created for you by the automation" />
      <Card>
        <QueryState query={query}>
          {(data) => (data.items.length === 0 ? <EmptyState message="You have no notifications." /> : (
            <ul className="divide-y divide-slate-100">
              {data.items.map((n) => (
                <li key={n.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${n.is_read ? 'opacity-60' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {!n.is_read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-500" aria-label="Unread" />}
                      {n.title}
                    </p>
                    <p className="text-sm text-slate-600">{n.message}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {humanize(n.type)} · {formatDateTime(n.created_at)}
                      {n.project_id && <> · <Link className="text-indigo-700 hover:underline" to={`/projects/${n.project_id}?tab=tasks`}>{n.project_code}</Link></>}
                    </p>
                  </div>
                  {!n.is_read && <Button size="sm" variant="secondary" loading={markRead.isPending && markRead.variables === n.id} onClick={() => markRead.mutate(n.id)}>Mark read</Button>}
                </li>
              ))}
            </ul>
          ))}
        </QueryState>
      </Card>
    </>
  );
}
