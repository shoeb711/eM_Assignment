// Tasks across all projects the user can see. Also the target of dashboard drill-downs,
// e.g. /tasks?overdue=true&departmentId=2 opens "overdue tasks in department 2".
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { tasksApi } from '../api/endpoints.js';
import { useListParams } from '../hooks/useListParams.js';
import { useLookups } from '../hooks/useLookups.js';
import { useProjectOptions } from '../hooks/useProjectOptions.js';
import { Button, Card, PageHeader, QueryState } from '../components/ui.jsx';
import { FilterSelect, toOptions } from '../components/form.jsx';
import { DataTable, Pagination } from '../components/DataTable.jsx';
import { taskColumns } from './project/TasksTab.jsx';
import { TaskFormModal } from './project/TaskFormModal.jsx';
import { humanize } from '../utils/format.js';

export function TasksPage() {
  const [params, setParams, clearParams] = useListParams({ sort: 'due_date', order: 'asc', page: '1' });
  const { departments, users } = useLookups();
  const projectOptions = useProjectOptions();
  const [editing, setEditing] = useState(null);

  const query = useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.list({ ...params, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  const toggle = (key) => (e) => setParams({ [key]: e.target.checked ? 'true' : '' });

  return (
    <>
      <PageHeader title="Tasks" subtitle="Tasks across the projects you can access. Click a task to update it." />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <FilterSelect label="Project" value={params.projectId} onChange={(v) => setParams({ projectId: v })} options={projectOptions} />
          <FilterSelect label="Department" value={params.departmentId} onChange={(v) => setParams({ departmentId: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label="Assignee" value={params.assigneeId} onChange={(v) => setParams({ assigneeId: v })}
            options={users.map((u) => ({ value: u.id, label: u.full_name }))} />
          <FilterSelect label="Status" value={params.status} onChange={(v) => setParams({ status: v })} options={toOptions(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'], humanize)} />
          <FilterSelect label="Priority" value={params.priority} onChange={(v) => setParams({ priority: v })} options={toOptions(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], humanize)} />
          <div className="flex flex-wrap gap-3 pb-1.5 text-sm text-slate-700">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={params.mine === 'true'} onChange={toggle('mine')} />My tasks</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={params.overdue === 'true'} onChange={toggle('overdue')} />Overdue</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={params.unassigned === 'true'} onChange={toggle('unassigned')} />Unassigned</label>
          </div>
          <Button variant="ghost" onClick={clearParams}>Clear filters</Button>
        </div>
        <QueryState query={query}>
          {(data) => (
            <>
              <DataTable
                columns={taskColumns({ showProject: true })}
                rows={data.items}
                sort={params.sort}
                order={params.order}
                onSort={(sort, order) => setParams({ sort, order })}
                onRowClick={(t) => setEditing(t)}
                emptyMessage="No tasks match these filters."
              />
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setParams({ page: String(page) })} />
            </>
          )}
        </QueryState>
      </Card>
      {editing && <TaskFormModal projectId={editing.project_id} task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
