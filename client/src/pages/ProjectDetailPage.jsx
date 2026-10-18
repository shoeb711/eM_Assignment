// One project with tabs: Overview, Tasks, Milestones, Risks & issues, Finance, Change requests.
// The active tab is kept in the URL (?tab=finance) so it survives a page refresh.
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/endpoints.js';
import { Badge, Button, Card, Detail, ErrorState, PageHeader, ProgressBar, Spinner, Tabs } from '../components/ui.jsx';
import { formatAED, formatDate } from '../utils/format.js';
import { ProjectFormModal } from './project/ProjectFormModal.jsx';
import { TasksTab } from './project/TasksTab.jsx';
import { MilestonesTab } from './project/MilestonesTab.jsx';
import { RisksTab } from './project/RisksTab.jsx';
import { FinanceTab } from './project/FinanceTab.jsx';
import { ChangeRequestsTab } from './project/ChangeRequestsTab.jsx';

export function ProjectDetailPage() {
  const projectId = Number(useParams().projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';
  const [editing, setEditing] = useState(false);

  const query = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId) });

  if (query.isLoading) return <Spinner />;
  if (query.isError) {
    return (
      <>
        <Link to="/projects" className="text-sm text-indigo-700 hover:underline">← Back to projects</Link>
        <div className="mt-4"><ErrorState error={query.error} /></div>
      </>
    );
  }
  const project = query.data;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks', count: project.total_tasks },
    { id: 'milestones', label: 'Milestones' },
    { id: 'risks', label: 'Risks & issues', count: project.open_risks },
    { id: 'finance', label: 'Finance' },
    { id: 'changes', label: 'Change requests', count: project.pending_change_requests },
  ];

  return (
    <>
      <Link to="/projects" className="text-sm text-indigo-700 hover:underline">← Back to projects</Link>
      <div className="mt-2">
        <PageHeader
          title={<span>{project.name} <span className="ml-2 font-mono text-sm font-normal text-slate-500">{project.code}</span></span>}
          subtitle={`${project.department_name} · Owner: ${project.owner_name}`}
          actions={(
            <>
              <Badge value={project.status} className="self-center" />
              {project.canManage && <Button variant="secondary" onClick={() => setEditing(true)}>Edit project</Button>}
            </>
          )}
        />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(id) => setSearchParams({ tab: id }, { replace: true })} />

      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'tasks' && <TasksTab project={project} />}
      {tab === 'milestones' && <MilestonesTab project={project} />}
      {tab === 'risks' && <RisksTab project={project} />}
      {tab === 'finance' && <FinanceTab project={project} />}
      {tab === 'changes' && <ChangeRequestsTab project={project} />}

      {editing && <ProjectFormModal open project={project} onClose={() => setEditing(false)} />}
    </>
  );
}

function OverviewTab({ project }) {
  const stats = [
    { label: 'Progress (weighted)', value: <ProgressBar value={project.progress_pct} /> },
    { label: 'Tasks done', value: `${project.done_tasks} / ${project.total_tasks}` },
    { label: 'Overdue tasks', value: project.overdue_tasks, alert: project.overdue_tasks > 0 },
    { label: 'Blocked tasks', value: project.blocked_tasks, alert: project.blocked_tasks > 0 },
    { label: 'Open risks / high exposure', value: `${project.open_risks} / ${project.high_risks}`, alert: project.high_risks > 0 },
    { label: 'Pending change requests', value: project.pending_change_requests },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Delivery status" className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <div className={`mt-1 text-lg font-semibold ${s.alert ? 'text-red-700' : 'text-slate-900'}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Progress = sum of (task weight × task progress) ÷ sum of task weights. Overdue = not done and due before the reporting date.
        </p>
      </Card>
      <Card title="Details">
        <dl className="space-y-3">
          <Detail label="Dates">{formatDate(project.start_date)} → {formatDate(project.end_date)}</Detail>
          <Detail label="Initial approved budget">{formatAED(project.initial_budget)}</Detail>
          <Detail label="Description">{project.description || '—'}</Detail>
          <Detail label="Team">
            <ul className="mt-1 space-y-0.5">
              {project.members.map((m) => <li key={m.id}>{m.full_name} <span className="text-xs text-slate-500">({m.role === 'CONTRIBUTOR' ? 'Contributor' : 'Manager'})</span></li>)}
            </ul>
          </Detail>
        </dl>
      </Card>
    </div>
  );
}
