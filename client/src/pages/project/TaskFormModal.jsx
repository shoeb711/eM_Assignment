// Create / edit / update-progress form for a task (business journey 2).
// What the form allows depends on who you are:
//   - project manager (owner) / admin -> every field
//   - the task's assignee              -> only status and progress
//   - anyone else                      -> read only
// (The API enforces exactly the same rules - this only shapes the UI.)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, tasksApi } from '../../api/endpoints.js';
import { fieldErrorsFrom } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useApiMutation, DELIVERY_KEYS } from '../../hooks/useApiMutation.js';
import { Button, Modal, Spinner } from '../../components/ui.jsx';
import { SelectInput, TextArea, TextInput, toOptions } from '../../components/form.jsx';
import { humanize } from '../../utils/format.js';

const STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function TaskFormModal({ projectId, task, onClose }) {
  const { user } = useAuth();
  // Loads the project for its member list and the "can manage" flag.
  const projectQuery = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId) });
  const project = projectQuery.data;

  const mode = !project ? 'loading'
    : project.canManage ? (task ? 'edit' : 'create')
      : task?.assignee_id === user.id ? 'progress' : 'view';

  return (
    <Modal open onClose={onClose} title={task ? task.title : 'New task'} size="lg">
      {mode === 'loading' ? <Spinner /> : <TaskForm mode={mode} project={project} task={task} onClose={onClose} />}
    </Modal>
  );
}

function TaskForm({ mode, project, task, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigneeId: task?.assignee_id || '',
    status: task?.status || 'TODO',
    priority: task?.priority || 'MEDIUM',
    startDate: task?.start_date || '',
    dueDate: task?.due_date || '',
    weight: task?.weight ?? 1,
    progress: task?.progress ?? 0,
  });
  const [errors, setErrors] = useState({});
  const readOnly = mode === 'view';
  const progressOnly = mode === 'progress';

  const save = useApiMutation(
    (data) => (mode === 'create' ? tasksApi.create(project.id, data) : tasksApi.update(task.id, data)),
    { invalidate: DELIVERY_KEYS, success: mode === 'create' ? 'Task created' : 'Task updated', onSuccess: onClose },
  );

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Keep status and progress consistent while typing (same rule as the server).
  function setStatus(e) {
    const status = e.target.value;
    setForm({ ...form, status, progress: status === 'DONE' ? 100 : Math.min(Number(form.progress), 99) });
  }
  function setProgress(e) {
    const progress = Number(e.target.value);
    setForm({ ...form, progress, status: progress === 100 ? 'DONE' : form.status === 'DONE' ? 'IN_PROGRESS' : form.status });
  }

  function validate() {
    const found = {};
    if (!progressOnly) {
      if (form.title.trim().length < 3) found.title = 'Title must be at least 3 characters';
      if (!form.dueDate) found.dueDate = 'Due date is required';
      if (form.startDate && form.dueDate && form.dueDate < form.startDate) found.dueDate = 'Due date must be on or after the start date';
    }
    if (form.progress < 0 || form.progress > 100) found.progress = 'Progress must be 0–100';
    return found;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = progressOnly
      ? { status: form.status, progress: Number(form.progress), version: task.version }
      : {
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
        status: form.status,
        priority: form.priority,
        startDate: form.startDate || null,
        dueDate: form.dueDate,
        weight: Number(form.weight),
        progress: Number(form.progress),
        ...(mode === 'edit' ? { version: task.version } : {}),
      };
    save.mutate(payload, { onError: (err) => setErrors(fieldErrorsFrom(err)) });
  }

  const memberOptions = project.members.map((m) => ({ value: m.id, label: m.full_name }));
  const lockOthers = readOnly || progressOnly;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {progressOnly && (
        <p className="mb-4 rounded bg-indigo-50 px-3 py-2 text-sm text-indigo-800">This task is assigned to you - you can update its status and progress.</p>
      )}
      {readOnly && <p className="mb-4 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">Read only - only the assignee or the project manager can change this task.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput id="t-title" label="Title" required className="sm:col-span-2" value={form.title} onChange={set('title')} error={errors.title} disabled={lockOthers} />
        <TextArea id="t-desc" label="Description" className="sm:col-span-2" value={form.description} onChange={set('description')} disabled={lockOthers} />
        <SelectInput id="t-assignee" label="Assignee" placeholder="Unassigned" value={form.assigneeId} onChange={set('assigneeId')} options={memberOptions} disabled={lockOthers} error={errors.assigneeId} />
        <SelectInput id="t-priority" label="Priority" value={form.priority} onChange={set('priority')} options={toOptions(PRIORITIES, humanize)} disabled={lockOthers} />
        <TextInput id="t-start" label="Start date" type="date" value={form.startDate} onChange={set('startDate')} disabled={lockOthers} />
        <TextInput id="t-due" label="Due date" type="date" required value={form.dueDate} onChange={set('dueDate')} error={errors.dueDate} disabled={lockOthers} />
        <TextInput id="t-weight" label="Weight (1–10)" type="number" min="1" max="10" value={form.weight} onChange={set('weight')} disabled={lockOthers}
          hint="How much this task counts towards project progress" />
        <SelectInput id="t-status" label="Status" value={form.status} onChange={setStatus} options={toOptions(STATUSES, humanize)} disabled={readOnly} />
        <div className="sm:col-span-2">
          <label htmlFor="t-progress" className="mb-1 block text-sm font-medium text-slate-700">Progress: {form.progress}%</label>
          <input id="t-progress" type="range" min="0" max="100" step="5" value={form.progress} onChange={setProgress} disabled={readOnly} className="w-full accent-indigo-600" />
          {errors.progress && <p className="mt-1 text-xs text-red-700">{errors.progress}</p>}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && <Button type="submit" loading={save.isPending}>{mode === 'create' ? 'Create task' : 'Save'}</Button>}
      </div>
    </form>
  );
}
