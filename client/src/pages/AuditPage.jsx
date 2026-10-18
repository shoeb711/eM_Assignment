// Administrator view: audit trail (who did what, when, with which request ID) and automation run history.
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { activityApi } from '../api/endpoints.js';
import { Badge, Card, PageHeader, QueryState, Tabs } from '../components/ui.jsx';
import { FilterSelect } from '../components/form.jsx';
import { DataTable, Pagination } from '../components/DataTable.jsx';
import { formatDateTime } from '../utils/format.js';

const ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'TASK_CREATED', 'TASK_UPDATED', 'COST_DRAFTED', 'COST_POSTED',
  'BUDGET_REVISION_REQUESTED', 'BUDGET_REVISION_APPROVED', 'BUDGET_REVISION_REJECTED', 'CHANGE_REQUEST_SUBMITTED',
  'CHANGE_REQUEST_APPROVED', 'CHANGE_REQUEST_REJECTED', 'CHANGE_REQUEST_RETURNED', 'FORECAST_UPDATED'];

export function AuditPage() {
  const [tab, setTab] = useState('audit');
  return (
    <>
      <PageHeader title="Audit & automation" subtitle="Append-only activity log and automation run history" />
      <Tabs tabs={[{ id: 'audit', label: 'Audit log' }, { id: 'runs', label: 'Automation runs' }]} active={tab} onChange={setTab} />
      {tab === 'audit' ? <AuditLog /> : <AutomationRuns />}
    </>
  );
}

function AuditLog() {
  const [filters, setFilters] = useState({ page: 1 });
  const query = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => activityApi.auditEvents({ ...filters, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
  const columns = [
    { key: 'time', label: 'When', render: (e) => <span className="whitespace-nowrap">{formatDateTime(e.created_at)}</span> },
    { key: 'actor', label: 'Who', render: (e) => e.actor_name || '—' },
    { key: 'action', label: 'Action', render: (e) => <span className="font-mono text-xs">{e.action}</span> },
    { key: 'entity', label: 'Record', render: (e) => `${e.entity_type} #${e.entity_id ?? '—'}` },
    { key: 'details', label: 'Details', render: (e) => <code className="block max-w-xs truncate text-xs text-slate-600" title={JSON.stringify(e.details)}>{e.details ? JSON.stringify(e.details) : ''}</code> },
    { key: 'request', label: 'Request ID', render: (e) => <span className="font-mono text-[11px] text-slate-500">{e.request_id}</span> },
  ];
  return (
    <Card>
      <div className="mb-3">
        <FilterSelect label="Action" value={filters.action} onChange={(v) => setFilters({ action: v || undefined, page: 1 })} options={ACTIONS.map((a) => ({ value: a, label: a }))} />
      </div>
      <QueryState query={query}>
        {(data) => (
          <>
            <DataTable columns={columns} rows={data.items} emptyMessage="No audit events." />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

function AutomationRuns() {
  const query = useQuery({ queryKey: ['automationRuns'], queryFn: activityApi.automationRuns });
  const columns = [
    { key: 'started', label: 'Started', render: (r) => formatDateTime(r.started_at) },
    { key: 'job', label: 'Job', render: (r) => <span className="font-mono text-xs">{r.job_name}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'attempt', label: 'Attempt' },
    { key: 'items', label: 'Alerts created', render: (r) => r.notifications_created },
    { key: 'error', label: 'Error', render: (r) => r.error_message || '—' },
  ];
  return (
    <Card>
      <QueryState query={query}>
        {(data) => <DataTable columns={columns} rows={data.items} emptyMessage="The automation has not run yet." />}
      </QueryState>
    </Card>
  );
}
