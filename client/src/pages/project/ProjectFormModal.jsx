// Create / edit project form (business journey 1).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api/endpoints.js';
import { fieldErrorsFrom } from '../../api/client.js';
import { useApiMutation } from '../../hooks/useApiMutation.js';
import { useLookups } from '../../hooks/useLookups.js';
import { Button, Modal } from '../../components/ui.jsx';
import { SelectInput, TextArea, TextInput, toOptions } from '../../components/form.jsx';
import { humanize } from '../../utils/format.js';

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

function initialForm(project) {
  return {
    name: project?.name || '',
    description: project?.description || '',
    departmentId: project?.department_id || '',
    ownerId: project?.owner_id || '',
    status: project?.status || 'PLANNING',
    startDate: project?.start_date || '',
    endDate: project?.end_date || '',
    initialBudget: project?.initial_budget ?? '',
    memberIds: project?.members?.map((m) => m.id) || [],
  };
}

// Checks done in the browser for quick feedback. The server checks everything again.
function validate(form) {
  const errors = {};
  if (form.name.trim().length < 3) errors.name = 'Name must be at least 3 characters';
  if (!form.departmentId) errors.departmentId = 'Choose a department';
  if (!form.ownerId) errors.ownerId = 'Choose a project owner';
  if (!form.startDate) errors.startDate = 'Start date is required';
  if (!form.endDate) errors.endDate = 'End date is required';
  if (form.startDate && form.endDate && form.endDate < form.startDate) errors.endDate = 'End date must be on or after the start date';
  if (form.initialBudget === '' || Number(form.initialBudget) < 0) errors.initialBudget = 'Enter a budget of 0 or more';
  return errors;
}

export function ProjectFormModal({ open, onClose, project }) {
  const isEdit = Boolean(project);
  const navigate = useNavigate();
  const { departments, managers, users } = useLookups();
  const [form, setForm] = useState(() => initialForm(project));
  const [errors, setErrors] = useState({});

  const save = useApiMutation(
    (data) => (isEdit ? projectsApi.update(project.id, { ...data, version: project.version }) : projectsApi.create(data)),
    {
      invalidate: ['projects', 'project', 'dashboard'],
      success: isEdit ? 'Project saved' : (p) => `Project ${p.code} created`,
      onSuccess: (saved) => {
        onClose();
        if (!isEdit) navigate(`/projects/${saved.id}`);
      },
    },
  );

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function toggleMember(userId) {
    const ids = form.memberIds.includes(userId) ? form.memberIds.filter((id) => id !== userId) : [...form.memberIds, userId];
    setForm({ ...form, memberIds: ids });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim(),
        departmentId: Number(form.departmentId),
        ownerId: Number(form.ownerId),
        status: form.status,
        startDate: form.startDate,
        endDate: form.endDate,
        initialBudget: Number(form.initialBudget),
        memberIds: form.memberIds,
      },
      { onError: (err) => setErrors(fieldErrorsFrom(err)) },
    );
  }

  const contributors = users.filter((u) => u.role === 'CONTRIBUTOR');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${project.code}` : 'New project'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="project-form" loading={save.isPending}>{isEdit ? 'Save changes' : 'Create project'}</Button>
        </>
      )}
    >
      <form id="project-form" onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextInput id="p-name" label="Project name" required className="sm:col-span-2" value={form.name} onChange={set('name')} error={errors.name} />
        <TextArea id="p-desc" label="Description" className="sm:col-span-2" value={form.description} onChange={set('description')} />
        <SelectInput id="p-dept" label="Department" required placeholder="Select…" value={form.departmentId} onChange={set('departmentId')} error={errors.departmentId}
          options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <SelectInput id="p-owner" label="Owner (project manager)" required placeholder="Select…" value={form.ownerId} onChange={set('ownerId')} error={errors.ownerId}
          options={managers.map((u) => ({ value: u.id, label: u.full_name }))} />
        <TextInput id="p-start" label="Start date" type="date" required value={form.startDate} onChange={set('startDate')} error={errors.startDate} />
        <TextInput id="p-end" label="End date" type="date" required value={form.endDate} onChange={set('endDate')} error={errors.endDate} />
        <TextInput id="p-budget" label="Initial approved budget (AED)" type="number" min="0" step="1000" required value={form.initialBudget}
          onChange={set('initialBudget')} error={errors.initialBudget}
          hint={isEdit ? 'Changes after approval should normally go through a budget revision.' : undefined} />
        <SelectInput id="p-status" label="Status" required value={form.status} onChange={set('status')} options={toOptions(STATUSES, humanize)} />

        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Team members (contributors)</legend>
          <div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-3">
            {contributors.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                {u.full_name}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
