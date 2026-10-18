// Risks & issues across projects - target of the dashboard risk drill-downs,
// e.g. /risks?open=true&highExposure=true or /risks?open=true&probability=4&impact=5
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { risksApi } from '../api/endpoints.js';
import { useListParams } from '../hooks/useListParams.js';
import { useProjectOptions } from '../hooks/useProjectOptions.js';
import { Button, Card, PageHeader, QueryState } from '../components/ui.jsx';
import { FilterSelect, toOptions } from '../components/form.jsx';
import { DataTable, Pagination } from '../components/DataTable.jsx';
import { riskColumns } from './project/RisksTab.jsx';
import { humanize } from '../utils/format.js';

export function RisksPage() {
  const navigate = useNavigate();
  const [params, setParams, clearParams] = useListParams({ page: '1' });
  const projectOptions = useProjectOptions();
  const query = useQuery({
    queryKey: ['risks', params],
    queryFn: () => risksApi.list({ ...params, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const toggle = (key) => (e) => setParams({ [key]: e.target.checked ? 'true' : '' });

  return (
    <>
      <PageHeader title="Risks & issues" subtitle="Across the projects you can access. Click a row to open the project." />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <FilterSelect label="Project" value={params.projectId} onChange={(v) => setParams({ projectId: v })} options={projectOptions} />
          <FilterSelect label="Type" value={params.type} onChange={(v) => setParams({ type: v })} options={toOptions(['RISK', 'ISSUE'], humanize)} />
          <FilterSelect label="Status" value={params.status} onChange={(v) => setParams({ status: v })} options={toOptions(['OPEN', 'MITIGATING', 'CLOSED'], humanize)} />
          <div className="flex gap-3 pb-1.5 text-sm text-slate-700">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={params.open === 'true'} onChange={toggle('open')} />Open only</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={params.highExposure === 'true'} onChange={toggle('highExposure')} />High exposure (≥ 15)</label>
          </div>
          {(params.probability || params.impact) && (
            <span className="pb-1.5 text-sm text-slate-700">Probability {params.probability} × impact {params.impact}</span>
          )}
          <Button variant="ghost" onClick={clearParams}>Clear filters</Button>
        </div>
        <QueryState query={query}>
          {(data) => (
            <>
              <DataTable columns={riskColumns({ showProject: true })} rows={data.items}
                onRowClick={(r) => navigate(`/projects/${r.project_id}?tab=risks`)} emptyMessage="No risks match these filters." />
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setParams({ page: String(page) })} />
            </>
          )}
        </QueryState>
      </Card>
    </>
  );
}
