// Cost transactions across projects. Target of finance drill-downs, e.g.
// /costs?projectId=2&status=POSTED&to=2026-09-30 lists exactly the rows behind a project's "Actual spend".
// The total at the top is calculated by the server for the same filters, so it can be compared with the KPI.
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { financeApi } from '../api/endpoints.js';
import { useListParams } from '../hooks/useListParams.js';
import { useLookups } from '../hooks/useLookups.js';
import { useProjectOptions } from '../hooks/useProjectOptions.js';
import { Badge, Button, Card, PageHeader, QueryState } from '../components/ui.jsx';
import { FilterSelect } from '../components/form.jsx';
import { DataTable, Pagination } from '../components/DataTable.jsx';
import { formatAED, formatDate } from '../utils/format.js';

export function CostsPage() {
  const [params, setParams, clearParams] = useListParams({ sort: 'txn_date', order: 'desc', page: '1' });
  const { departments, costCategories } = useLookups();
  const projectOptions = useProjectOptions();

  const query = useQuery({
    queryKey: ['costs', params],
    queryFn: () => financeApi.listCosts({ ...params, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });

  const columns = [
    { key: 'date', label: 'Date', sortKey: 'txn_date', render: (c) => formatDate(c.txn_date) },
    { key: 'project', label: 'Project', sortKey: 'project', render: (c) => <span className="font-mono text-xs">{c.project_code}</span> },
    { key: 'category', label: 'Category', sortKey: 'category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', sortKey: 'amount', className: 'text-right', render: (c) => <span className="tabular-nums">{formatAED(c.amount, { exact: true })}</span> },
    { key: 'status', label: 'Status', sortKey: 'status', render: (c) => <Badge value={c.status} /> },
    { key: 'posted', label: 'Posted by', render: (c) => c.posted_by_name ? `${c.posted_by_name}` : '—' },
  ];

  const dateInput = (key, label) => (
    <label className="flex flex-col text-xs text-slate-500">
      <span className="mb-1">{label}</span>
      <input type="date" value={params[key] || ''} onChange={(e) => setParams({ [key]: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
  );

  return (
    <>
      <PageHeader title="Cost transactions" subtitle="Posted and draft costs across the projects you can access" />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <FilterSelect label="Project" value={params.projectId} onChange={(v) => setParams({ projectId: v })} options={projectOptions} />
          <FilterSelect label="Department" value={params.departmentId} onChange={(v) => setParams({ departmentId: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label="Category" value={params.categoryId} onChange={(v) => setParams({ categoryId: v })}
            options={costCategories.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect label="Status" value={params.status} onChange={(v) => setParams({ status: v })}
            options={[{ value: 'POSTED', label: 'Posted' }, { value: 'DRAFT', label: 'Draft' }]} />
          {dateInput('from', 'From')}
          {dateInput('to', 'To')}
          <Button variant="ghost" onClick={clearParams}>Clear filters</Button>
        </div>
        <QueryState query={query}>
          {(data) => (
            <>
              <p className="mb-3 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                {data.total} transaction{data.total === 1 ? '' : 's'} · total <span className="font-semibold tabular-nums">{formatAED(data.totalAmount, { exact: true })}</span>
                {params.month && <> · month {params.month}</>}
              </p>
              <DataTable columns={columns} rows={data.items} sort={params.sort} order={params.order}
                onSort={(sort, order) => setParams({ sort, order })} emptyMessage="No cost transactions match these filters." />
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setParams({ page: String(page) })} />
            </>
          )}
        </QueryState>
      </Card>
    </>
  );
}
