// Project portfolio list: search, filters (department, owner, status, dates), sort, pagination.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { projectsApi } from '../api/endpoints.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useListParams } from '../hooks/useListParams.js';
import { useLookups } from '../hooks/useLookups.js';
import { Badge, Button, Card, PageHeader, ProgressBar, QueryState } from '../components/ui.jsx';
import { FilterSelect, toOptions } from '../components/form.jsx';
import { DataTable, Pagination } from '../components/DataTable.jsx';
import { ProjectFormModal } from './project/ProjectFormModal.jsx';
import { formatAED, formatDate, humanize } from '../utils/format.js';

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

export function ProjectsPage() {
  const navigate = useNavigate();
  const { isManagerRole } = useAuth();
  const { departments, managers } = useLookups();
  const [params, setParams, clearParams] = useListParams({ sort: 'code', order: 'asc', page: '1' });
  const [search, setSearch] = useState(params.search || '');
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectsApi.list({ ...params, pageSize: 10 }),
    placeholderData: keepPreviousData, // keep the old page visible while the next one loads
  });

  const columns = [
    { key: 'code', label: 'Code', sortKey: 'code', render: (p) => <span className="whitespace-nowrap font-mono text-xs">{p.code}</span> },
    { key: 'name', label: 'Project', sortKey: 'name', render: (p) => <span className="font-medium text-slate-900">{p.name}</span> },
    { key: 'department_name', label: 'Department' },
    { key: 'owner_name', label: 'Owner', sortKey: 'owner' },
    { key: 'status', label: 'Status', sortKey: 'status', render: (p) => <Badge value={p.status} /> },
    { key: 'dates', label: 'Dates', sortKey: 'end_date', render: (p) => <span className="whitespace-nowrap text-xs text-slate-600">{formatDate(p.start_date)} → {formatDate(p.end_date)}</span> },
    { key: 'progress', label: 'Progress', sortKey: 'progress', className: 'w-40', render: (p) => <ProgressBar value={p.progress_pct} /> },
    { key: 'overdue', label: 'Overdue', render: (p) => (p.overdue_tasks > 0 ? <span className="font-medium text-red-700">{p.overdue_tasks}</span> : <span className="text-slate-400">0</span>) },
    { key: 'budget', label: 'Initial budget', sortKey: 'initial_budget', className: 'text-right', render: (p) => <span className="tabular-nums">{formatAED(p.initial_budget)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="All projects you can access"
        actions={isManagerRole && <Button onClick={() => setCreating(true)}>+ New project</Button>}
      />

      <Card>
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); setParams({ search }); }}
        >
          <label className="flex flex-col text-xs text-slate-500">
            <span className="mb-1">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <FilterSelect label="Department" value={params.departmentId} onChange={(v) => setParams({ departmentId: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label="Owner" value={params.ownerId} onChange={(v) => setParams({ ownerId: v })}
            options={managers.map((u) => ({ value: u.id, label: u.full_name }))} />
          <FilterSelect label="Status" value={params.status} onChange={(v) => setParams({ status: v })} options={toOptions(STATUSES, humanize)} />
          <label className="flex flex-col text-xs text-slate-500">
            <span className="mb-1">Starts from</span>
            <input type="date" value={params.startFrom || ''} onChange={(e) => setParams({ startFrom: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            <span className="mb-1">Ends by</span>
            <input type="date" value={params.endTo || ''} onChange={(e) => setParams({ endTo: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <Button type="submit" variant="secondary">Search</Button>
          <Button variant="ghost" onClick={() => { setSearch(''); clearParams(); }}>Clear</Button>
        </form>

        <QueryState query={query}>
          {(data) => (
            <>
              <DataTable
                columns={columns}
                rows={data.items}
                sort={params.sort}
                order={params.order}
                onSort={(sort, order) => setParams({ sort, order })}
                onRowClick={(p) => navigate(`/projects/${p.id}`)}
                emptyMessage="No projects match these filters."
              />
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setParams({ page: String(page) })} />
            </>
          )}
        </QueryState>
      </Card>

      {creating && <ProjectFormModal open onClose={() => setCreating(false)} />}
    </>
  );
}
