import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { tasksApi } from '../../api/endpoints.js';
import { Badge, Button, Card, QueryState, ProgressBar } from '../../components/ui.jsx';
import { FilterSelect, toOptions } from '../../components/form.jsx';
import { DataTable, Pagination } from '../../components/DataTable.jsx';
import { TaskFormModal } from './TaskFormModal.jsx';
import { formatDate, humanize } from '../../utils/format.js';

// Columns shared by the project Tasks tab and the global Tasks page.
export function taskColumns({ showProject = false } = {}) {
  return [
    ...(showProject ? [{ key: 'project', label: 'Project', sortKey: 'project', render: (t) => <span className="font-mono text-xs">{t.project_code}</span> }] : []),
    { key: 'title', label: 'Task', sortKey: 'title', render: (t) => <span className="font-medium text-slate-900">{t.title}</span> },
    { key: 'assignee', label: 'Assignee', sortKey: 'assignee', render: (t) => t.assignee_name || <span className="italic text-slate-400">Unassigned</span> },
    { key: 'priority', label: 'Priority', sortKey: 'priority', render: (t) => <Badge value={t.priority} /> },
    { key: 'status', label: 'Status', sortKey: 'status', render: (t) => <Badge value={t.status} /> },
    {
      key: 'due', label: 'Due', sortKey: 'due_date',
      render: (t) => (
        <span className={`whitespace-nowrap ${t.is_overdue ? 'font-medium text-red-700' : t.is_due_soon ? 'text-amber-700' : ''}`}>
          {formatDate(t.due_date)}{t.is_overdue && ' · overdue'}{t.is_due_soon && ' · due soon'}
        </span>
      ),
    },
    { key: 'weight', label: 'Weight', className: 'text-center' },
    { key: 'progress', label: 'Progress', sortKey: 'progress', className: 'w-36', render: (t) => <ProgressBar value={t.progress} /> },
  ];
}

export function TasksTab({ project }) {
  const [filters, setFilters] = useState({ sort: 'due_date', order: 'asc', page: 1 });
  const [editing, setEditing] = useState(null); // null | 'new' | task

  const query = useQuery({
    queryKey: ['tasks', { projectId: project.id, ...filters }],
    queryFn: () => tasksApi.list({ projectId: project.id, ...filters, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });
  const update = (changes) => setFilters({ ...filters, page: 1, ...changes });

  return (
    <Card
      title="Tasks"
      actions={project.canManage && <Button size="sm" onClick={() => setEditing('new')}>+ Add task</Button>}
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FilterSelect label="Status" value={filters.status} onChange={(v) => update({ status: v || undefined })} options={toOptions(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'], humanize)} />
        <label className="flex items-center gap-2 pb-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={!!filters.overdue} onChange={(e) => update({ overdue: e.target.checked || undefined })} />
          Overdue only
        </label>
      </div>
      <QueryState query={query}>
        {(data) => (
          <>
            <DataTable
              columns={taskColumns()}
              rows={data.items}
              sort={filters.sort}
              order={filters.order}
              onSort={(sort, order) => update({ sort, order })}
              onRowClick={(t) => setEditing(t)}
              emptyMessage="No tasks match."
            />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </QueryState>
      {editing && <TaskFormModal projectId={project.id} task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
