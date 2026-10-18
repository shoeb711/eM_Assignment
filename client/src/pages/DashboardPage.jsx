// =====================================================================
// Executive dashboard (Section 5)
// ---------------------------------------------------------------------
// - ONE request: GET /api/dashboard?filters  -> every KPI and chart comes from SQL on the server.
// - Filters live in the URL, scope every card and chart, and are passed on to drill-downs,
//   so a drill-down list always shows exactly the records behind the number you clicked.
// - After any save elsewhere in the app, the 'dashboard' query is invalidated and refetched
//   (see useApiMutation) - the browser never adjusts a KPI by itself.
// =====================================================================
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { apiFetch, toQueryString } from '../api/client.js';
import { useListParams } from '../hooks/useListParams.js';
import { useLookups } from '../hooks/useLookups.js';
import { useProjectOptions } from '../hooks/useProjectOptions.js';
import { Button, ErrorState, PageHeader, Spinner } from '../components/ui.jsx';
import { FilterSelect, toOptions } from '../components/form.jsx';
import {
  AXIS, ChartCard, CountTooltip, GRID, Legend, MoneyTooltip, SEQUENTIAL, SERIES, STATUS, moneyTick,
} from '../components/charts.jsx';
import { formatAED, formatAEDShort, formatDate, formatPct, humanize } from '../utils/format.js';

// Period presets for the trend and category charts (counted back from the reporting date).
const PERIODS = [
  { value: '12m', label: 'Last 12 months', monthsBack: 11 },
  { value: 'ytd', label: 'Year to date' },
  { value: '6m', label: 'Last 6 months', monthsBack: 5 },
  { value: '3m', label: 'Last 3 months', monthsBack: 2 },
];

function periodRange(period, asOf) {
  if (!asOf) return {};
  if (period === 'ytd') return { from: `${asOf.slice(0, 4)}-01-01`, to: asOf };
  const months = PERIODS.find((p) => p.value === period)?.monthsBack ?? 11;
  const start = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - months);
  return { from: start.toISOString().slice(0, 10), to: asOf };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { departments, managers, costCategories, reportingDate } = useLookups();
  const projectOptions = useProjectOptions();
  const [params, setParams, clearParams] = useListParams({ period: '12m' });
  const { from, to } = periodRange(params.period, reportingDate);

  const filters = {
    departmentId: params.departmentId, projectId: params.projectId, managerId: params.managerId,
    status: params.status, categoryId: params.categoryId, from, to,
  };
  const query = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => apiFetch(`/dashboard${toQueryString(filters)}`),
    enabled: Boolean(reportingDate),
    placeholderData: keepPreviousData, // keep the old charts on screen while new numbers load
  });

  // Filters that every drill-down list understands, so the list matches the dashboard scope.
  const scope = { departmentId: params.departmentId, projectId: params.projectId, managerId: params.managerId, projectStatus: params.status };
  const link = (path, extra = {}) => `${path}${toQueryString({ ...scope, ...extra })}`;

  return (
    <>
      <PageHeader title="Executive dashboard" subtitle={`Portfolio delivery and financial position as of ${formatDate(reportingDate)}`} />

      {/* ---------- Filters: one row, above everything they scope ---------- */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <FilterSelect label="Period (trend & category)" allLabel="Last 12 months" value={params.period === '12m' ? '' : params.period}
          onChange={(v) => setParams({ period: v || '12m' })} options={PERIODS.filter((p) => p.value !== '12m')} />
        <FilterSelect label="Department" value={params.departmentId} onChange={(v) => setParams({ departmentId: v })}
          options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <FilterSelect label="Project" value={params.projectId} onChange={(v) => setParams({ projectId: v })} options={projectOptions} />
        <FilterSelect label="Project manager" value={params.managerId} onChange={(v) => setParams({ managerId: v })}
          options={managers.map((u) => ({ value: u.id, label: u.full_name }))} />
        <FilterSelect label="Lifecycle status" value={params.status} onChange={(v) => setParams({ status: v })}
          options={toOptions(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'], humanize)} />
        <FilterSelect label="Cost category (finance charts)" value={params.categoryId} onChange={(v) => setParams({ categoryId: v })}
          options={costCategories.map((c) => ({ value: c.id, label: c.name }))} />
        <Button variant="ghost" onClick={clearParams}>Reset</Button>
      </div>

      {query.isLoading && <Spinner label="Calculating KPIs…" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && (
        <div className={`space-y-5 transition-opacity ${query.isFetching ? 'opacity-60' : ''}`}>
          <KpiSections data={query.data} link={link} />
          <Charts data={query.data} link={link} navigate={navigate} period={{ from, to }} params={params} />
          <KpiExplanation data={query.data} link={link} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------
function KpiCard({ label, value, note, to, tone }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900';
  const body = (
    <>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
    </>
  );
  const base = 'block rounded-lg border border-slate-200 bg-white p-3';
  return to
    ? <Link to={to} className={`${base} hover:border-indigo-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`} title="Click to see the records behind this number">{body}</Link>
    : <div className={base}>{body}</div>;
}

function KpiSections({ data, link }) {
  const k = data.kpis;
  const completion = k.total_tasks ? (100 * k.done_tasks) / k.total_tasks : null;
  const groups = [
    {
      title: 'Delivery',
      cards: [
        { label: 'Projects (active / total)', value: `${k.active_projects} / ${k.total_projects}`, to: link('/projects', { status: 'ACTIVE' }) },
        { label: 'Portfolio progress (weighted)', value: formatPct(k.progress_pct), note: `${k.done_tasks} of ${k.total_tasks} tasks done (${formatPct(completion)})` },
        { label: 'Overdue incomplete tasks', value: k.overdue_tasks, tone: k.overdue_tasks ? 'bad' : undefined, to: link('/tasks', { overdue: 'true' }), note: 'Not done, due before reporting date' },
        { label: 'Milestones due in 14 days', value: k.milestones_due_14d, tone: k.milestones_due_14d ? 'warn' : undefined, note: 'See roadmap below' },
      ],
    },
    {
      title: 'Risk & governance',
      cards: [
        { label: 'Open high-exposure risks', value: k.open_high_risks, tone: k.open_high_risks ? 'bad' : undefined, to: link('/risks', { open: 'true', highExposure: 'true' }), note: 'Score ≥ 15, not closed' },
        { label: 'Blocked tasks', value: k.blocked_tasks, tone: k.blocked_tasks ? 'warn' : undefined, to: link('/tasks', { status: 'BLOCKED' }) },
        { label: 'Pending change requests', value: k.pending_change_requests, to: '/change-requests?status=SUBMITTED' },
      ],
    },
    {
      title: 'Financial',
      cards: [
        { label: 'Approved budget', value: formatAEDShort(k.approved_budget), note: 'Initial + approved revisions' },
        { label: 'Actual spend', value: formatAEDShort(k.actual_spend), note: 'Posted costs to reporting date', to: link('/costs', { status: 'POSTED', to: data.asOf }) },
        { label: 'Remaining budget', value: formatAEDShort(k.remaining_budget), tone: k.remaining_budget < 0 ? 'bad' : undefined },
        { label: 'Utilization', value: formatPct(k.utilization_pct), tone: k.utilization_pct >= 90 ? 'warn' : undefined },
        { label: 'Forecast EAC', value: formatAEDShort(k.eac), note: `Actual + ${formatAEDShort(k.forecast_to_complete)} forecast` },
        { label: 'Projects forecast to overrun', value: k.overrun_projects, tone: k.overrun_projects ? 'bad' : undefined, note: `Total overrun ${formatAEDShort(k.overrun_amount)}` },
      ],
    },
  ];
  return groups.map((g) => (
    <section key={g.title} aria-label={g.title}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {g.cards.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>
    </section>
  ));
}

// ---------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------
function Charts({ data, link, navigate, period, params }) {
  const reportingMonth = data.asOf.slice(0, 7);
  const categoryName = data.spendByCategory.length === 1 && params.categoryId ? data.spendByCategory[0].category : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 1. Budget vs actual vs EAC (finance drill-down: click a project) */}
      <ChartCard
        title="Budget vs actual vs EAC by project"
        subtitle="AED · click a project to see its posted cost transactions"
        table={{
          columns: [
            { key: 'code', label: 'Project' },
            { key: 'current_budget', label: 'Budget', format: (v) => formatAED(v) },
            { key: 'actual_spend', label: 'Actual', format: (v) => formatAED(v) },
            { key: 'eac', label: 'EAC', format: (v) => formatAED(v) },
            { key: 'projected_variance', label: 'Variance', format: (v) => formatAED(v) },
          ],
          rows: data.projects,
        }}
      >
        <Legend items={[{ label: 'Approved budget', color: SERIES[0] }, { label: 'Actual spend', color: SERIES[1] }, { label: 'EAC (forecast)', color: SERIES[2] }]} />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.projects} barGap={2} barCategoryGap="20%"
            onClick={(e) => e?.activePayload && navigate(link('/costs', { projectId: e.activePayload[0].payload.project_id, status: 'POSTED', to: data.asOf }))}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="code" {...AXIS} tick={{ ...AXIS.tick, fontSize: 10 }} interval={0} tickLine={false} />
            <YAxis tickFormatter={moneyTick} {...AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<MoneyTooltip hint="Click to open transactions" />} cursor={{ fill: '#f0efec' }} />
            <Bar isAnimationActive={false} dataKey="current_budget" name="Approved budget" fill={SERIES[0]} radius={[4, 4, 0, 0]} className="cursor-pointer" />
            <Bar isAnimationActive={false} dataKey="actual_spend" name="Actual spend" fill={SERIES[1]} radius={[4, 4, 0, 0]} className="cursor-pointer" />
            <Bar isAnimationActive={false} dataKey="eac" name="EAC" fill={SERIES[2]} radius={[4, 4, 0, 0]} className="cursor-pointer" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Project health */}
      <ProjectHealth projects={data.projects} />

      {/* 3. Monthly cost trend (click a month -> that month's transactions) */}
      <ChartCard
        className="lg:col-span-2"
        title="Monthly cost trend"
        subtitle={`Posted spend ${formatDate(period.from)} – ${formatDate(period.to)}, then monthly forecast · AED${categoryName ? ` · ${categoryName} only (forecasts have no category)` : ''}`}
        table={{
          columns: [{ key: 'month', label: 'Month' }, { key: 'actual', label: 'Actual', format: (v) => formatAED(v) }, { key: 'forecast', label: 'Forecast', format: (v) => formatAED(v) }],
          rows: data.monthly,
        }}
      >
        <Legend items={[{ label: 'Actual (posted)', color: SERIES[0] }, { label: 'Forecast', color: SERIES[1] }]} />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.monthly} barGap={2} margin={{ top: 20 }}
            onClick={(e) => {
              const row = e?.activePayload?.[0]?.payload;
              if (row && row.actual > 0) navigate(link('/costs', { month: row.month, status: 'POSTED', categoryId: params.categoryId }));
            }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" {...AXIS} tickLine={false} />
            <YAxis tickFormatter={moneyTick} {...AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<MoneyTooltip hint="Click an actual month to open its transactions" />} cursor={{ fill: '#f0efec' }} />
            <ReferenceLine x={reportingMonth} stroke="#898781" strokeDasharray="3 3" label={{ value: 'Reporting date', position: 'top', fill: '#52514e', fontSize: 11 }} />
            <Bar isAnimationActive={false} dataKey="actual" name="Actual" fill={SERIES[0]} radius={[4, 4, 0, 0]} className="cursor-pointer" />
            <Bar isAnimationActive={false} dataKey="forecast" name="Forecast" fill={SERIES[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Spend by category */}
      <ChartCard
        title="Spend by category"
        subtitle={`Posted, ${formatDate(period.from)} – ${formatDate(period.to)} · click a category for its transactions`}
        table={{ columns: [{ key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', format: (v) => formatAED(v) }], rows: data.spendByCategory }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data.spendByCategory} layout="vertical" margin={{ left: 10, right: 16 }}
            onClick={(e) => e?.activePayload && navigate(link('/costs', { categoryId: e.activePayload[0].payload.category_id, status: 'POSTED', from: period.from, to: period.to }))}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" tickFormatter={moneyTick} {...AXIS} tickLine={false} />
            <YAxis type="category" dataKey="category" width={150} {...AXIS} tickLine={false} />
            <Tooltip content={<MoneyTooltip hint="Click to open transactions" />} cursor={{ fill: '#f0efec' }} />
            <Bar isAnimationActive={false} dataKey="amount" name="Posted spend" fill={SERIES[0]} radius={[0, 4, 4, 0]} className="cursor-pointer" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5. Overdue work by owner (delivery drill-down) */}
      <ChartCard
        title="Overdue tasks by owner"
        subtitle="Incomplete tasks past due · click a bar to open those tasks"
        table={{ columns: [{ key: 'owner', label: 'Owner' }, { key: 'overdue_tasks', label: 'Overdue tasks' }], rows: data.overdueByOwner }}
      >
        {data.overdueByOwner.length === 0 ? <p className="py-16 text-center text-sm text-slate-500">No overdue tasks in this selection.</p> : (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data.overdueByOwner} layout="vertical" margin={{ left: 10, right: 16 }}
              onClick={(e) => {
                const row = e?.activePayload?.[0]?.payload;
                if (row) navigate(link('/tasks', { overdue: 'true', ...(row.assignee_id ? { assigneeId: row.assignee_id } : { unassigned: 'true' }) }));
              }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" allowDecimals={false} {...AXIS} tickLine={false} />
              <YAxis type="category" dataKey="owner" width={120} {...AXIS} tickLine={false} />
              <Tooltip content={<CountTooltip unit="overdue tasks" hint="Click to open the tasks" />} cursor={{ fill: '#f0efec' }} />
              <Bar isAnimationActive={false} dataKey="overdue_tasks" name="Overdue tasks" fill={SERIES[0]} radius={[0, 4, 4, 0]} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* 6. Risk matrix */}
      <RiskMatrix cells={data.riskMatrix} link={link} />

      {/* 7. Milestone roadmap */}
      <ChartCard title="Milestone roadmap" subtitle="Late milestones and those due in the next 45 days">
        {data.milestones.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No upcoming milestones.</p> : (
          <ol className="space-y-2">
            {data.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-24 shrink-0 tabular-nums ${m.is_late ? 'font-medium text-red-700' : 'text-slate-600'}`}>{formatDate(m.due_date)}</span>
                  <Link to={`/projects/${m.project_id}?tab=milestones`} className="font-mono text-xs text-indigo-700 hover:underline">{m.project_code}</Link>
                  <span className="text-slate-800">{m.name}</span>
                </div>
                <span className={`text-xs ${m.is_late ? 'text-red-700' : 'text-slate-500'}`}>{m.is_late ? '⚠ Late' : humanize(m.status)}</span>
              </li>
            ))}
          </ol>
        )}
      </ChartCard>
    </div>
  );
}

const HEALTH_LABEL = { RED: 'Off track', AMBER: 'At risk', GREEN: 'On track', CLOSED: 'Closed' };
const HEALTH_ICON = { RED: '✕', AMBER: '!', GREEN: '✓', CLOSED: '–' };

function ProjectHealth({ projects }) {
  const counts = ['RED', 'AMBER', 'GREEN', 'CLOSED'].map((h) => ({ health: h, count: projects.filter((p) => p.health === h).length }));
  return (
    <ChartCard
      title="Project health"
      subtitle="Red: forecast overrun or 3+ overdue tasks · Amber: ≥90% budget used, any overdue task or open high risk"
      table={{
        columns: [{ key: 'code', label: 'Project' }, { key: 'health', label: 'Health', format: (v) => HEALTH_LABEL[v] },
          { key: 'progress_pct', label: 'Progress', format: (v) => formatPct(v) }, { key: 'overdue_tasks', label: 'Overdue' }, { key: 'high_risks', label: 'High risks' }],
        rows: projects,
      }}
    >
      <div className="mb-3 flex flex-wrap gap-3">
        {counts.map((c) => (
          <span key={c.health} className="flex items-center gap-1.5 text-sm text-slate-700">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: STATUS[c.health] }} aria-hidden>{HEALTH_ICON[c.health]}</span>
            {HEALTH_LABEL[c.health]} <span className="font-semibold">{c.count}</span>
          </span>
        ))}
      </div>
      <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
        {projects.map((p) => (
          <li key={p.project_id}>
            <Link to={`/projects/${p.project_id}`} className="flex items-center justify-between gap-2 py-1.5 text-sm hover:bg-slate-50">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: STATUS[p.health] }} aria-hidden>{HEALTH_ICON[p.health]}</span>
                <span className="font-mono text-xs">{p.code}</span> <span className="text-slate-800">{p.name}</span>
              </span>
              <span className="text-xs text-slate-500">{HEALTH_LABEL[p.health]} · {formatPct(p.progress_pct)} done</span>
            </Link>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function RiskMatrix({ cells, link }) {
  const count = (p, i) => cells.find((c) => c.probability === p && c.impact === i)?.count || 0;
  const max = Math.max(1, ...cells.map((c) => c.count));
  // 0 = neutral grey; 1..max = light -> dark blue (one hue, light to dark)
  const step = (n) => (n === 0 ? 0 : Math.min(SEQUENTIAL.length - 1, 1 + Math.round(((n - 1) / Math.max(1, max - 1)) * (SEQUENTIAL.length - 2))));
  return (
    <ChartCard
      title="Risk matrix (open risks & issues)"
      subtitle="Probability × impact · outlined cells are high exposure (score ≥ 15) · click a cell"
      table={{ columns: [{ key: 'probability', label: 'Probability' }, { key: 'impact', label: 'Impact' }, { key: 'count', label: 'Open items' }], rows: cells }}
    >
      <div className="flex gap-2">
        <div className="flex flex-col justify-center text-xs text-slate-500" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Impact →</div>
        <div className="flex-1">
          <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-0.5">
            {[5, 4, 3, 2, 1].map((impact) => (
              [<div key={`l${impact}`} className="flex items-center pr-1 text-xs text-slate-500">{impact}</div>,
                ...[1, 2, 3, 4, 5].map((prob) => {
                  const n = count(prob, impact);
                  const high = prob * impact >= 15;
                  const cellStyle = { background: SEQUENTIAL[step(n)], color: step(n) >= 4 ? '#fff' : '#0b0b0b' }; // white text only on dark cells
                  const cls = `flex h-10 items-center justify-center rounded text-sm font-semibold ${high ? 'ring-2 ring-inset ring-red-400' : ''}`;
                  return n > 0 ? (
                    <Link key={`${prob}-${impact}`} to={link('/risks', { open: 'true', probability: prob, impact })} style={cellStyle}
                      className={`${cls} hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
                      title={`Probability ${prob} × impact ${impact} = ${prob * impact}: ${n} open`}>{n}</Link>
                  ) : <div key={`${prob}-${impact}`} style={cellStyle} className={cls} aria-label={`Probability ${prob}, impact ${impact}: none`} />;
                })]
            ))}
            <div />
            {[1, 2, 3, 4, 5].map((p) => <div key={`x${p}`} className="text-center text-xs text-slate-500">{p}</div>)}
          </div>
          <p className="mt-1 text-center text-xs text-slate-500">Probability →</p>
        </div>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------
// "Where do these numbers come from?" - two KPIs traced back to SQL
// ---------------------------------------------------------------------
function KpiExplanation({ data, link }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-slate-800">How are these KPIs calculated?</summary>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <p className="font-medium">Actual spend = {formatAED(data.kpis.actual_spend, { exact: true })}</p>
          <p className="mt-1 text-slate-600">Source table <code>cost_transactions</code>. Sum of <code>amount</code> where <code>status = 'POSTED'</code> and <code>txn_date ≤ {data.asOf}</code>, for projects in the current filter. Drafts and costs dated after the reporting date are excluded.</p>
          <Link className="mt-1 inline-block text-indigo-700 hover:underline" to={link('/costs', { status: 'POSTED', to: data.asOf })}>Open the exact transactions →</Link>
        </div>
        <div>
          <p className="font-medium">Overdue incomplete tasks = {data.kpis.overdue_tasks}</p>
          <p className="mt-1 text-slate-600">Source table <code>tasks</code>. Count where <code>status ≠ 'DONE'</code> and <code>due_date &lt; {data.asOf}</code> (a task due exactly on the reporting date is not overdue yet), for projects in the current filter.</p>
          <Link className="mt-1 inline-block text-indigo-700 hover:underline" to={link('/tasks', { overdue: 'true' })}>Open the exact tasks →</Link>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Each KPI is aggregated from one table at a time (never by joining tasks, risks and costs together), so totals cannot be inflated by row multiplication.</p>
    </details>
  );
}
