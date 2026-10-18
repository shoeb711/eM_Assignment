// Risks & issues of a project + create/edit form (business journey 3).
// Score = probability x impact (1-25). Score >= 15 is "high exposure".
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { risksApi } from '../../api/endpoints.js';
import { fieldErrorsFrom } from '../../api/client.js';
import { useApiMutation, DELIVERY_KEYS } from '../../hooks/useApiMutation.js';
import { Badge, Button, Card, Modal, QueryState, ScoreBadge } from '../../components/ui.jsx';
import { FilterSelect, SelectInput, TextArea, TextInput, toOptions } from '../../components/form.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { formatDate, humanize } from '../../utils/format.js';

const STATUSES = ['OPEN', 'MITIGATING', 'CLOSED'];
const ONE_TO_FIVE = toOptions([1, 2, 3, 4, 5], String);

export function riskColumns({ showProject = false } = {}) {
  return [
    ...(showProject ? [{ key: 'project', label: 'Project', render: (r) => <span className="font-mono text-xs">{r.project_code}</span> }] : []),
    { key: 'type', label: 'Type', render: (r) => humanize(r.type) },
    { key: 'title', label: 'Title', render: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
    { key: 'owner', label: 'Owner', render: (r) => r.owner_name || '—' },
    { key: 'pi', label: 'P × I', render: (r) => `${r.probability} × ${r.impact}` },
    { key: 'score', label: 'Score', render: (r) => <ScoreBadge score={r.score} /> },
    { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'due', label: 'Due', render: (r) => formatDate(r.due_date) },
  ];
}

export function RisksTab({ project }) {
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState('');
  const query = useQuery({
    queryKey: ['risks', { projectId: project.id, status }],
    queryFn: () => risksApi.list({ projectId: project.id, status, pageSize: 100 }),
  });

  return (
    <Card title="Risks & issues" actions={project.canManage && <Button size="sm" onClick={() => setEditing('new')}>+ Add risk / issue</Button>}>
      <div className="mb-3 flex items-end gap-3">
        <FilterSelect label="Status" value={status} onChange={setStatus} options={toOptions(STATUSES, humanize)} />
        <p className="pb-1.5 text-xs text-slate-500">Score = probability × impact. Red = high exposure (≥ 15).</p>
      </div>
      <QueryState query={query}>
        {(data) => (
          <DataTable columns={riskColumns()} rows={data.items} onRowClick={project.canManage ? (r) => setEditing(r) : undefined}
            emptyMessage="No risks or issues recorded." />
        )}
      </QueryState>
      {editing && <RiskFormModal project={project} risk={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RiskFormModal({ project, risk, onClose }) {
  const [form, setForm] = useState({
    type: risk?.type || 'RISK',
    title: risk?.title || '',
    description: risk?.description || '',
    ownerId: risk?.owner_id || '',
    probability: risk?.probability || 3,
    impact: risk?.impact || 3,
    mitigation: risk?.mitigation || '',
    dueDate: risk?.due_date || '',
    status: risk?.status || 'OPEN',
  });
  const [errors, setErrors] = useState({});
  const save = useApiMutation(
    (data) => (risk ? risksApi.update(risk.id, { ...data, version: risk.version }) : risksApi.create(project.id, data)),
    { invalidate: DELIVERY_KEYS, success: 'Risk saved', onSuccess: onClose },
  );
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const score = Number(form.probability) * Number(form.impact);

  function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (form.title.trim().length < 3) found.title = 'Title must be at least 3 characters';
    if (form.status === 'CLOSED' && !form.mitigation.trim()) found.mitigation = 'Add a mitigation note before closing';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      ownerId: form.ownerId ? Number(form.ownerId) : null,
      probability: Number(form.probability),
      impact: Number(form.impact),
      mitigation: form.mitigation.trim() || null,
      dueDate: form.dueDate || null,
      status: form.status,
    }, { onError: (err) => setErrors(fieldErrorsFrom(err)) });
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={risk ? 'Edit risk / issue' : 'New risk / issue'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="risk-form" loading={save.isPending}>Save</Button></>}
    >
      <form id="risk-form" onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <SelectInput id="r-type" label="Type" value={form.type} onChange={set('type')} options={toOptions(['RISK', 'ISSUE'], humanize)} />
        <SelectInput id="r-status" label="Status" value={form.status} onChange={set('status')} options={toOptions(STATUSES, humanize)} />
        <TextInput id="r-title" label="Title" required className="sm:col-span-2" value={form.title} onChange={set('title')} error={errors.title} />
        <TextArea id="r-desc" label="Description" className="sm:col-span-2" value={form.description} onChange={set('description')} />
        <SelectInput id="r-owner" label="Owner" placeholder="Not assigned" value={form.ownerId} onChange={set('ownerId')} error={errors.ownerId}
          options={project.members.map((m) => ({ value: m.id, label: m.full_name }))} />
        <TextInput id="r-due" label="Due date" type="date" value={form.dueDate} onChange={set('dueDate')} />
        <SelectInput id="r-prob" label="Probability (1–5)" value={form.probability} onChange={set('probability')} options={ONE_TO_FIVE} />
        <SelectInput id="r-impact" label="Impact (1–5)" value={form.impact} onChange={set('impact')} options={ONE_TO_FIVE} />
        <p className="sm:col-span-2 text-sm text-slate-700">Score: <ScoreBadge score={score} /> {score >= 15 && <span className="ml-1 text-red-700">High exposure</span>}</p>
        <TextArea id="r-mitigation" label="Mitigation" className="sm:col-span-2" value={form.mitigation} onChange={set('mitigation')} error={errors.mitigation} />
      </form>
    </Modal>
  );
}
