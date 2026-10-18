import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { changeRequestsApi } from '../../api/endpoints.js';
import { Badge, Button, Card, QueryState } from '../../components/ui.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { ChangeRequestDetailModal, SubmitChangeRequestModal } from './ChangeRequestModals.jsx';
import { formatAED, formatDate } from '../../utils/format.js';

export function changeRequestColumns({ showProject = false } = {}) {
  return [
    { key: 'id', label: 'ID', render: (c) => <span className="font-mono text-xs">CR-{c.id}</span> },
    ...(showProject ? [{ key: 'project', label: 'Project', render: (c) => <span className="font-mono text-xs">{c.project_code}</span> }] : []),
    { key: 'title', label: 'Title', render: (c) => <span className="font-medium text-slate-900">{c.title}</span> },
    { key: 'cost', label: 'Cost impact', className: 'text-right', render: (c) => <span className="tabular-nums">{formatAED(c.cost_impact)}</span> },
    { key: 'by', label: 'Submitted by', render: (c) => c.submitted_by_name },
    { key: 'at', label: 'Submitted', render: (c) => formatDate(c.submitted_at) },
    { key: 'status', label: 'Status', render: (c) => <Badge value={c.status} /> },
    { key: 'decided', label: 'Decided by', render: (c) => c.decided_by_name || '—' },
  ];
}

export function ChangeRequestsTab({ project }) {
  const [submitting, setSubmitting] = useState(false);
  const [openId, setOpenId] = useState(null);
  const query = useQuery({
    queryKey: ['changeRequests', { projectId: project.id }],
    queryFn: () => changeRequestsApi.list({ projectId: project.id, pageSize: 100 }),
  });

  return (
    <Card title="Change requests" actions={<Button size="sm" onClick={() => setSubmitting(true)}>+ New change request</Button>}>
      <QueryState query={query}>
        {(data) => <DataTable columns={changeRequestColumns()} rows={data.items} onRowClick={(c) => setOpenId(c.id)} emptyMessage="No change requests yet." />}
      </QueryState>
      {submitting && <SubmitChangeRequestModal project={project} onClose={() => setSubmitting(false)} />}
      {openId && <ChangeRequestDetailModal changeRequestId={openId} onClose={() => setOpenId(null)} />}
    </Card>
  );
}
