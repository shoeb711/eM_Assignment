// Milestones of a project + create/edit form (business journey 3).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { milestonesApi } from '../../api/endpoints.js';
import { fieldErrorsFrom } from '../../api/client.js';
import { useApiMutation, DELIVERY_KEYS } from '../../hooks/useApiMutation.js';
import { Badge, Button, Card, Modal, QueryState } from '../../components/ui.jsx';
import { SelectInput, TextInput, toOptions } from '../../components/form.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { formatDate, humanize } from '../../utils/format.js';

const STATUSES = ['PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED'];

export function MilestonesTab({ project }) {
  const [editing, setEditing] = useState(null);
  const query = useQuery({
    queryKey: ['milestones', { projectId: project.id }],
    queryFn: () => milestonesApi.list({ projectId: project.id, pageSize: 100 }),
  });

  const columns = [
    { key: 'name', label: 'Milestone', render: (m) => <span className="font-medium text-slate-900">{m.name}</span> },
    { key: 'due', label: 'Due', render: (m) => <span className={m.is_late ? 'font-medium text-red-700' : ''}>{formatDate(m.due_date)}{m.is_late && ' · late'}</span> },
    { key: 'status', label: 'Status', render: (m) => <Badge value={m.status} /> },
    { key: 'completed', label: 'Achieved on', render: (m) => formatDate(m.completed_at) },
  ];

  return (
    <Card title="Milestones" actions={project.canManage && <Button size="sm" onClick={() => setEditing('new')}>+ Add milestone</Button>}>
      <QueryState query={query}>
        {(data) => (
          <DataTable columns={columns} rows={data.items} onRowClick={project.canManage ? (m) => setEditing(m) : undefined} emptyMessage="No milestones yet." />
        )}
      </QueryState>
      {editing && <MilestoneFormModal project={project} milestone={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function MilestoneFormModal({ project, milestone, onClose }) {
  const [form, setForm] = useState({ name: milestone?.name || '', dueDate: milestone?.due_date || '', status: milestone?.status || 'PLANNED' });
  const [errors, setErrors] = useState({});
  const save = useApiMutation(
    (data) => (milestone ? milestonesApi.update(milestone.id, { ...data, version: milestone.version }) : milestonesApi.create(project.id, data)),
    { invalidate: DELIVERY_KEYS, success: 'Milestone saved', onSuccess: onClose },
  );

  function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (form.name.trim().length < 3) found.name = 'Name must be at least 3 characters';
    if (!form.dueDate) found.dueDate = 'Due date is required';
    else if (form.dueDate < project.start_date || form.dueDate > project.end_date) {
      found.dueDate = `Must be between ${formatDate(project.start_date)} and ${formatDate(project.end_date)}`;
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({ name: form.name.trim(), dueDate: form.dueDate, status: form.status }, { onError: (err) => setErrors(fieldErrorsFrom(err)) });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={milestone ? 'Edit milestone' : 'New milestone'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="ms-form" loading={save.isPending}>Save</Button></>}
    >
      <form id="ms-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextInput id="ms-name" label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <TextInput id="ms-due" label="Due date" type="date" required min={project.start_date} max={project.end_date} value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })} error={errors.dueDate} />
        <SelectInput id="ms-status" label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={toOptions(STATUSES, humanize)} />
      </form>
    </Modal>
  );
}
