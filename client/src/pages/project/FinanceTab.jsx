// Project finance (Section 4): budget, actual spend, remaining, utilization, forecast, EAC,
// alerts, spend by category, monthly trend, cost transactions, budget revisions.
// Every number here comes from the server's SQL (GET /projects/:id/finance) - nothing is calculated in the browser.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { changeRequestsApi, financeApi } from '../../api/endpoints.js';
import { useApiMutation, FINANCE_KEYS } from '../../hooks/useApiMutation.js';
import { Badge, Button, Card, ConfirmDialog, QueryState } from '../../components/ui.jsx';
import { DataTable, Pagination } from '../../components/DataTable.jsx';
import { FilterSelect } from '../../components/form.jsx';
import { CostFormModal, ForecastModal, RevisionFormModal } from './FinanceForms.jsx';
import { formatAED, formatDate, formatPct } from '../../utils/format.js';

const ALERT_STYLES = {
  OVERSPENT: 'border-red-300 bg-red-50 text-red-800',
  FORECAST_OVERRUN: 'border-red-300 bg-red-50 text-red-800',
  NEARING_BUDGET: 'border-amber-300 bg-amber-50 text-amber-800',
  FORECAST_MISSING: 'border-slate-300 bg-slate-50 text-slate-700',
};

export function FinanceTab({ project }) {
  const query = useQuery({ queryKey: ['finance', project.id], queryFn: () => financeApi.projectSummary(project.id) });
  return <QueryState query={query}>{(finance) => <FinanceContent project={project} finance={finance} />}</QueryState>;
}

function FinanceContent({ project, finance }) {
  const { summary: s, permissions } = finance;
  const [modal, setModal] = useState(null); // 'cost' | 'revision' | 'forecast'

  const kpis = [
    { label: 'Current approved budget', value: formatAED(s.current_budget), note: `Initial ${formatAED(s.initial_budget)} + approved revisions ${formatAED(s.approved_revisions)}` },
    { label: 'Actual spend', value: formatAED(s.actual_spend), note: `Posted costs up to ${formatDate(finance.asOf)}` },
    { label: 'Remaining budget', value: formatAED(s.remaining_budget), alert: s.remaining_budget < 0 },
    { label: 'Utilization', value: formatPct(s.utilization_pct), alert: s.utilization_pct >= 90 },
    { label: 'Forecast to complete', value: s.forecast_missing ? 'No forecast' : formatAED(s.forecast_to_complete) },
    { label: 'Estimate at completion (EAC)', value: formatAED(s.eac), note: 'Actual + forecast to complete' },
    { label: 'Projected variance', value: formatAED(s.projected_variance), alert: s.projected_variance < 0, note: 'Budget − EAC (negative = overrun)' },
  ];

  return (
    <div className="space-y-4">
      {finance.alerts.map((a) => (
        <div key={a.type} className={`rounded-md border px-4 py-2 text-sm ${ALERT_STYLES[a.type]}`} role="alert">
          <span className="font-semibold">{a.type.replace(/_/g, ' ')}:</span> {a.message}
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${k.alert ? 'text-red-700' : 'text-slate-900'}`}>{k.value}</p>
            {k.note && <p className="mt-0.5 text-[11px] text-slate-500">{k.note}</p>}
          </div>
        ))}
        <div className="flex items-center rounded-lg border border-dashed border-slate-300 p-3 text-sm">
          <Link to={`/costs?projectId=${project.id}&status=POSTED&to=${finance.asOf}`} className="text-indigo-700 hover:underline">
            See the transactions behind "Actual spend" →
          </Link>
        </div>
      </div>

      {permissions.canManage && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal('cost')}>+ Add cost</Button>
          <Button variant="secondary" onClick={() => setModal('revision')}>Request budget revision</Button>
          <Button variant="secondary" onClick={() => setModal('forecast')}>Edit forecast</Button>
        </div>
      )}

      <CostsCard project={project} canManage={permissions.canManage} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Spend by category">
          <ul className="space-y-2">
            {finance.byCategory.map((c) => {
              const pct = s.actual_spend > 0 ? (100 * c.amount) / s.actual_spend : 0;
              return (
                <li key={c.category_id} className="text-sm">
                  <div className="flex justify-between"><span>{c.category}</span><span className="tabular-nums">{formatAED(c.amount)}</span></div>
                  <div className="mt-1 h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-indigo-400" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Monthly spend (actual) and forecast">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Month</th><th className="text-right">Actual</th><th className="text-right">Forecast</th></tr></thead>
              <tbody>
                {finance.monthly.map((m) => (
                  <tr key={m.month} className="border-t border-slate-100">
                    <td className="py-1">{m.month}</td>
                    <td className="text-right tabular-nums">{m.actual ? formatAED(m.actual) : '—'}</td>
                    <td className="text-right tabular-nums text-slate-500">{m.forecast ? formatAED(m.forecast) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <RevisionsCard finance={finance} />

      {modal === 'cost' && <CostFormModal project={project} onClose={() => setModal(null)} />}
      {modal === 'revision' && <RevisionModalLoader project={project} onClose={() => setModal(null)} />}
      {modal === 'forecast' && <ForecastModal project={project} forecasts={finance.forecasts} reportingDate={finance.asOf} onClose={() => setModal(null)} />}
    </div>
  );
}

// Loads approved change requests so a revision can be linked to one.
function RevisionModalLoader({ project, onClose }) {
  const crs = useQuery({
    queryKey: ['changeRequests', { projectId: project.id, status: 'APPROVED' }],
    queryFn: () => changeRequestsApi.list({ projectId: project.id, status: 'APPROVED', pageSize: 100 }),
  });
  return <RevisionFormModal project={project} approvedChangeRequests={crs.data?.items || []} onClose={onClose} />;
}

function CostsCard({ project, canManage }) {
  const [filters, setFilters] = useState({ page: 1 });
  const [action, setAction] = useState(null); // { type: 'post' | 'delete', cost }
  const query = useQuery({
    queryKey: ['costs', { projectId: project.id, ...filters }],
    queryFn: () => financeApi.listCosts({ projectId: project.id, ...filters, pageSize: 10 }),
  });

  const run = useApiMutation(
    ({ type, cost }) => (type === 'post' ? financeApi.postCost(cost.id) : financeApi.deleteCost(cost.id)),
    { invalidate: FINANCE_KEYS, success: (data) => (data?.status === 'POSTED' ? 'Cost posted - finance figures updated' : 'Draft deleted'), onSuccess: () => setAction(null) },
  );

  const columns = [
    { key: 'date', label: 'Date', render: (c) => formatDate(c.txn_date) },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', className: 'text-right', render: (c) => <span className="tabular-nums">{formatAED(c.amount, { exact: true })}</span> },
    { key: 'status', label: 'Status', render: (c) => <Badge value={c.status} /> },
    { key: 'by', label: 'Posted by', render: (c) => c.posted_by_name || <span className="text-slate-400">—</span> },
    ...(canManage ? [{
      key: 'actions', label: '', render: (c) => c.status === 'DRAFT' && (
        <div className="flex gap-1">
          <Button size="sm" variant="success" onClick={() => setAction({ type: 'post', cost: c })}>Post</Button>
          <Button size="sm" variant="ghost" onClick={() => setAction({ type: 'delete', cost: c })}>Delete</Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <Card title="Cost transactions">
      <div className="mb-3">
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters({ status: v || undefined, page: 1 })}
          options={[{ value: 'DRAFT', label: 'Draft' }, { value: 'POSTED', label: 'Posted' }]} />
      </div>
      <QueryState query={query}>
        {(data) => (
          <>
            <DataTable columns={columns} rows={data.items} emptyMessage="No cost transactions yet." />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setFilters({ ...filters, page })} />
          </>
        )}
      </QueryState>
      <ConfirmDialog
        open={!!action}
        title={action?.type === 'post' ? 'Post this cost?' : 'Delete this draft?'}
        message={action?.type === 'post'
          ? `${formatAED(action?.cost.amount, { exact: true })} will count as actual spend. Posted costs cannot be edited or deleted.`
          : 'The draft cost will be removed.'}
        confirmLabel={action?.type === 'post' ? 'Post cost' : 'Delete draft'}
        variant={action?.type === 'post' ? 'success' : 'danger'}
        loading={run.isPending}
        onConfirm={() => run.mutate(action)}
        onCancel={() => setAction(null)}
      />
    </Card>
  );
}

function RevisionsCard({ finance }) {
  const [deciding, setDeciding] = useState(null); // { revision, decision }
  const decide = useApiMutation(({ revision, decision }) => financeApi.decideRevision(revision.id, decision), {
    invalidate: FINANCE_KEYS, success: 'Budget revision decided', onSuccess: () => setDeciding(null),
  });

  const columns = [
    { key: 'requested', label: 'Requested', render: (b) => formatDate(b.requested_at) },
    { key: 'amount', label: 'Amount', className: 'text-right', render: (b) => <span className="tabular-nums">{b.amount > 0 ? '+' : ''}{formatAED(b.amount)}</span> },
    { key: 'reason', label: 'Reason', render: (b) => <span>{b.reason}{b.change_request_id && <span className="ml-1 text-xs text-slate-500">(CR-{b.change_request_id})</span>}</span> },
    { key: 'by', label: 'Requested by', render: (b) => b.requested_by_name },
    { key: 'status', label: 'Status', render: (b) => <Badge value={b.status} /> },
    { key: 'decided', label: 'Decided by', render: (b) => b.decided_by_name || '—' },
    ...(finance.permissions.canDecideRevisions ? [{
      key: 'actions', label: '', render: (b) => b.status === 'PENDING' && (
        <div className="flex gap-1">
          <Button size="sm" variant="success" onClick={() => setDeciding({ revision: b, decision: 'APPROVE' })}>Approve</Button>
          <Button size="sm" variant="ghost" onClick={() => setDeciding({ revision: b, decision: 'REJECT' })}>Reject</Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <Card title="Budget revisions">
      <p className="mb-2 text-xs text-slate-500">Only APPROVED revisions change the current approved budget. Pending and rejected revisions have no effect.</p>
      <DataTable columns={columns} rows={finance.budgetRevisions} emptyMessage="No budget revisions." />
      <ConfirmDialog
        open={!!deciding}
        title={deciding?.decision === 'APPROVE' ? 'Approve budget revision?' : 'Reject budget revision?'}
        message={`${deciding?.decision === 'APPROVE' ? 'Approve' : 'Reject'} a change of ${formatAED(deciding?.revision.amount)} to the approved budget.`}
        confirmLabel={deciding?.decision === 'APPROVE' ? 'Approve' : 'Reject'}
        variant={deciding?.decision === 'APPROVE' ? 'success' : 'danger'}
        loading={decide.isPending}
        onConfirm={() => decide.mutate(deciding)}
        onCancel={() => setDeciding(null)}
      />
    </Card>
  );
}
