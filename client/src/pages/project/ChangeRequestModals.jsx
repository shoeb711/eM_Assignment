// Change request forms (business journey 5):
//   - SubmitChangeRequestModal: any project member submits a request
//   - ChangeRequestDetailModal: details + full history; the owner PM/admin approves, rejects or returns;
//     the submitter re-submits a RETURNED request.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { changeRequestsApi } from '../../api/endpoints.js';
import { fieldErrorsFrom } from '../../api/client.js';
import { useApiMutation } from '../../hooks/useApiMutation.js';
import { Badge, Button, Detail, Modal, QueryState } from '../../components/ui.jsx';
import { TextArea, TextInput } from '../../components/form.jsx';
import { formatAED, formatDateTime, humanize } from '../../utils/format.js';

const CR_KEYS = ['changeRequests', 'project', 'projects', 'dashboard'];

export function SubmitChangeRequestModal({ project, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', costImpact: '0', scheduleImpactDays: '0' });
  const [errors, setErrors] = useState({});
  const save = useApiMutation((data) => changeRequestsApi.submit(project.id, data), {
    invalidate: CR_KEYS, success: 'Change request submitted for review', onSuccess: onClose,
  });
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (form.title.trim().length < 5) found.title = 'Title must be at least 5 characters';
    if (form.description.trim().length < 10) found.description = 'Describe the change (10+ characters)';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      costImpact: Number(form.costImpact) || 0,
      scheduleImpactDays: Number(form.scheduleImpactDays) || 0,
    }, { onError: (err) => setErrors(fieldErrorsFrom(err)) });
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`New change request - ${project.code}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="cr-form" loading={save.isPending}>Submit</Button></>}
    >
      <form id="cr-form" onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextInput id="cr-title" label="Title" required className="sm:col-span-2" value={form.title} onChange={set('title')} error={errors.title} />
        <TextArea id="cr-desc" label="Description and justification" required rows={4} className="sm:col-span-2" value={form.description} onChange={set('description')} error={errors.description} />
        <TextInput id="cr-cost" label="Cost impact (AED)" type="number" step="1000" value={form.costImpact} onChange={set('costImpact')} hint="Negative = saving" />
        <TextInput id="cr-days" label="Schedule impact (days)" type="number" value={form.scheduleImpactDays} onChange={set('scheduleImpactDays')} />
      </form>
    </Modal>
  );
}

export function ChangeRequestDetailModal({ changeRequestId, onClose }) {
  const query = useQuery({ queryKey: ['changeRequests', 'detail', changeRequestId], queryFn: () => changeRequestsApi.get(changeRequestId) });
  return (
    <Modal open size="lg" onClose={onClose} title={`Change request CR-${changeRequestId}`}>
      <QueryState query={query}>{(cr) => <ChangeRequestDetail cr={cr} onClose={onClose} />}</QueryState>
    </Modal>
  );
}

function ChangeRequestDetail({ cr, onClose }) {
  const [decision, setDecision] = useState(null); // 'APPROVE' | 'REJECT' | 'RETURN'
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [resubmitText, setResubmitText] = useState(cr.description);

  const decide = useApiMutation((data) => changeRequestsApi.decide(cr.id, data), {
    invalidate: CR_KEYS, success: (saved) => `Change request ${humanize(saved.status).toLowerCase()}`, onSuccess: onClose,
  });
  const resubmit = useApiMutation((data) => changeRequestsApi.resubmit(cr.id, data), {
    invalidate: CR_KEYS, success: 'Change request re-submitted', onSuccess: onClose,
  });

  function confirmDecision() {
    if (reason.trim().length < 5) {
      setReasonError('A reason of at least 5 characters is required');
      return;
    }
    // version = the version we loaded; if someone else decided in the meantime the server answers 409.
    decide.mutate({ decision, reason: reason.trim(), version: cr.version });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">{cr.title}</h3>
        <Badge value={cr.status} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Detail label="Project">{cr.project_code} · {cr.project_name}</Detail>
        <Detail label="Cost impact">{formatAED(cr.cost_impact)}</Detail>
        <Detail label="Schedule impact">{cr.schedule_impact_days} days</Detail>
        <Detail label="Submitted by">{cr.submitted_by_name}</Detail>
        <Detail label="Submitted">{formatDateTime(cr.submitted_at)}</Detail>
        <Detail label="Decided by">{cr.decided_by_name || '—'}</Detail>
      </dl>
      <p className="whitespace-pre-line rounded bg-slate-50 p-3 text-sm text-slate-700">{cr.description}</p>
      {cr.decision_reason && <p className="text-sm"><span className="font-medium">Decision reason:</span> {cr.decision_reason}</p>}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">History</h4>
        <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
          {cr.history.map((h) => (
            <li key={h.id} className="text-sm">
              <span className="font-medium">{h.from_status ? `${humanize(h.from_status)} → ${humanize(h.to_status)}` : humanize(h.to_status)}</span>
              <span className="text-slate-500"> · {h.actor_name} · {formatDateTime(h.created_at)}</span>
              {h.comment && <p className="text-slate-600">{h.comment}</p>}
            </li>
          ))}
        </ol>
      </div>

      {cr.canDecide && !decision && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button variant="success" onClick={() => setDecision('APPROVE')}>Approve</Button>
          <Button variant="danger" onClick={() => setDecision('REJECT')}>Reject</Button>
          <Button variant="secondary" onClick={() => setDecision('RETURN')}>Return for changes</Button>
        </div>
      )}
      {decision && (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <p className="text-sm font-medium">{humanize(decision)} this change request?</p>
          <TextArea id="decision-reason" label="Reason (saved in the history)" required value={reason}
            onChange={(e) => { setReason(e.target.value); setReasonError(''); }} error={reasonError} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDecision(null)}>Cancel</Button>
            <Button variant={decision === 'REJECT' ? 'danger' : decision === 'APPROVE' ? 'success' : 'primary'} loading={decide.isPending} onClick={confirmDecision}>
              Confirm {humanize(decision).toLowerCase()}
            </Button>
          </div>
        </div>
      )}
      {!cr.canDecide && cr.status === 'SUBMITTED' && (
        <p className="text-xs text-slate-500">Waiting for the project manager or an administrator. The person who submitted a request can never decide it.</p>
      )}
      {cr.canResubmit && (
        <div className="space-y-3 rounded-md border border-purple-200 bg-purple-50 p-3">
          <p className="text-sm font-medium text-purple-900">This request was returned to you. Update it and re-submit.</p>
          <TextArea id="resubmit-desc" label="Updated description" value={resubmitText} onChange={(e) => setResubmitText(e.target.value)} />
          <div className="flex justify-end">
            <Button loading={resubmit.isPending} onClick={() => resubmit.mutate({
              description: resubmitText.trim(), costImpact: cr.cost_impact, scheduleImpactDays: cr.schedule_impact_days, version: cr.version,
            })}>Re-submit</Button>
          </div>
        </div>
      )}
    </div>
  );
}
