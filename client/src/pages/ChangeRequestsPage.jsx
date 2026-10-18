// Change requests across projects - defaults to the approval queue (status SUBMITTED).
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { changeRequestsApi } from '../api/endpoints.js';
import { useListParams } from '../hooks/useListParams.js';
import { useProjectOptions } from '../hooks/useProjectOptions.js';
import { Card, PageHeader, QueryState } from '../components/ui.jsx';
import { FilterSelect, toOptions } from '../components/form.jsx';
import { DataTable, Pagination } from '../components/DataTable.jsx';
import { changeRequestColumns } from './project/ChangeRequestsTab.jsx';
import { ChangeRequestDetailModal } from './project/ChangeRequestModals.jsx';
import { humanize } from '../utils/format.js';

export function ChangeRequestsPage() {
  const [params, setParams] = useListParams({ status: 'SUBMITTED', page: '1' });
  const projectOptions = useProjectOptions();
  const [openId, setOpenId] = useState(null);

  const query = useQuery({
    queryKey: ['changeRequests', params],
    // 'ALL' means "no status filter" (an empty value would fall back to the default SUBMITTED queue)
    queryFn: () => changeRequestsApi.list({ ...params, status: params.status === 'ALL' ? undefined : params.status, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Change requests" subtitle="Submitted requests wait here for a decision by the project manager or an administrator." />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <FilterSelect label="Status" allLabel="All statuses" value={params.status === 'ALL' ? '' : params.status} onChange={(v) => setParams({ status: v || 'ALL' })}
            options={toOptions(['SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED'], humanize)} />
          <FilterSelect label="Project" value={params.projectId} onChange={(v) => setParams({ projectId: v })} options={projectOptions} />
          <label className="flex items-center gap-1.5 pb-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={params.mine === 'true'} onChange={(e) => setParams({ mine: e.target.checked ? 'true' : '' })} />
            Submitted by me
          </label>
        </div>
        <QueryState query={query}>
          {(data) => (
            <>
              <DataTable columns={changeRequestColumns({ showProject: true })} rows={data.items} onRowClick={(c) => setOpenId(c.id)} emptyMessage="No change requests match." />
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => setParams({ page: String(page) })} />
            </>
          )}
        </QueryState>
      </Card>
      {openId && <ChangeRequestDetailModal changeRequestId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
