// Administrator view: audit trail (who did what, when, with which request ID) and automation run history.
import { useState } from 'react';
import { useApiMutation } from '../hooks/useApiMutation.js';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { activityApi } from '../api/endpoints.js';
import { Badge, Button, Card, PageHeader, QueryState, Tabs } from '../components/ui.jsx';
import { FilterSelect } from '../components/form.jsx';
import { DataTable, Pagination } from '../components/DataTable.jsx';
import { formatDateTime } from '../utils/format.js';

const ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'TASK_CREATED', 'TASK_UPDATED', 'COST_DRAFTED', 'COST_POSTED',
  'BUDGET_REVISION_REQUESTED', 'BUDGET_REVISION_APPROVED', 'BUDGET_REVISION_REJECTED', 'CHANGE_REQUEST_SUBMITTED',
  'CHANGE_REQUEST_APPROVED', 'CHANGE_REQUEST_REJECTED', 'CHANGE_REQUEST_RETURNED', 'FORECAST_UPDATED', 'AUTOMATION_TRIGGERED'];

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
  const [simulateFailure, setSimulateFailure] = useState(false);
  const run = useApiMutation(() => activityApi.runAutomation(simulateFailure), {
    invalidate: ['automationRuns', 'notifications', 'audit'],
    success: (r) => `Run finished: ${r.status} after ${r.attempts} attempt${r.attempts > 1 ? 's' : ''} · ${r.created} new alert${r.created === 1 ? '' : 's'}`,
  });
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
      <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-medium">Overdue task alerts</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Runs automatically every few minutes. Creates one in-app alert per overdue task (to the assignee, or the project manager if unassigned).
          Each alert has a unique key, so re-running never creates duplicates. A failed attempt is logged and retried (up to 3 attempts).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button loading={run.isPending} onClick={() => run.mutate()}>Run now</Button>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
            Simulate a failure on the first attempt (to demonstrate retry)
          </label>
        </div>
      </div>
      <QueryState query={query}>
        {(data) => <DataTable columns={columns} rows={data.items} emptyMessage="The automation has not run yet." />}
      </QueryState>
    </Card>
  );
}
