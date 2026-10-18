// Finance forms: add a cost, request a budget revision, edit monthly forecasts.
import { useRef, useState } from 'react';
import { financeApi } from '../../api/endpoints.js';
import { fieldErrorsFrom } from '../../api/client.js';
import { useApiMutation, FINANCE_KEYS } from '../../hooks/useApiMutation.js';
import { useLookups } from '../../hooks/useLookups.js';
import { Button, ConfirmDialog, Modal } from '../../components/ui.jsx';
import { SelectInput, TextArea, TextInput } from '../../components/form.jsx';
import { formatAED } from '../../utils/format.js';

// ---------- Add cost (business journey 4) ----------
export function CostFormModal({ project, onClose }) {
  const { costCategories, reportingDate } = useLookups();
  // One key per form: if "Save" is clicked twice or the request is retried, the server
  // recognises the key and does NOT create a second cost.
  const idempotencyKey = useRef(crypto.randomUUID()).current;
  const [form, setForm] = useState({ categoryId: '', description: '', amount: '', txnDate: reportingDate || '', post: false });
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);

  const save = useApiMutation(
    (data) => financeApi.createCost(project.id, data, idempotencyKey),
    { invalidate: FINANCE_KEYS, success: form.post ? 'Cost posted - finance figures updated' : 'Draft cost saved', onSuccess: onClose },
  );
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function validate() {
    const found = {};
    const amount = Number(form.amount);
    if (!form.categoryId) found.categoryId = 'Choose a category';
    if (form.description.trim().length < 3) found.description = 'Describe the cost (3+ characters)';
    if (!form.amount || Number.isNaN(amount) || amount <= 0) found.amount = 'Amount must be greater than zero';
    else if (Math.round(amount * 100) !== amount * 100) found.amount = 'At most 2 decimal places';
    if (!form.txnDate) found.txnDate = 'Date is required';
    else if (form.txnDate < project.start_date) found.txnDate = 'Cannot be before the project start date';
    return found;
  }

  function submit() {
    save.mutate(
      { categoryId: Number(form.categoryId), description: form.description.trim(), amount: Number(form.amount), txnDate: form.txnDate, post: form.post },
      { onError: (err) => { setConfirming(false); setErrors(fieldErrorsFrom(err)); } },
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    if (form.post) setConfirming(true); // posting is final -> ask first
    else submit();
  }

  return (
    <>
      <Modal
        open={!confirming}
        onClose={onClose}
        title={`Add cost - ${project.code}`}
        footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="cost-form" loading={save.isPending}>{form.post ? 'Post cost' : 'Save draft'}</Button></>}
      >
        <form id="cost-form" onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <SelectInput id="c-cat" label="Category" required placeholder="Select…" value={form.categoryId} onChange={set('categoryId')} error={errors.categoryId}
            options={costCategories.map((c) => ({ value: c.id, label: c.name }))} />
          <TextInput id="c-date" label="Transaction date" type="date" required value={form.txnDate} onChange={set('txnDate')} error={errors.txnDate}
            hint={reportingDate && form.txnDate > reportingDate ? 'After the reporting date - not counted in the current KPIs' : undefined} />
          <TextInput id="c-desc" label="Description" required className="sm:col-span-2" value={form.description} onChange={set('description')} error={errors.description} />
          <TextInput id="c-amount" label="Amount (AED)" type="number" min="0.01" step="0.01" required value={form.amount} onChange={set('amount')} error={errors.amount} />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.post} onChange={(e) => setForm({ ...form, post: e.target.checked })} />
            Post immediately (counts as actual spend)
          </label>
        </form>
      </Modal>
      <ConfirmDialog
        open={confirming}
        title="Post this cost?"
        message={`${formatAED(Number(form.amount), { exact: true })} will be posted to ${project.code}. Posted costs cannot be edited or deleted.`}
        confirmLabel="Post cost"
        loading={save.isPending}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

// ---------- Request a budget revision ----------
export function RevisionFormModal({ project, approvedChangeRequests, onClose }) {
  const [form, setForm] = useState({ amount: '', reason: '', changeRequestId: '' });
  const [errors, setErrors] = useState({});
  const save = useApiMutation((data) => financeApi.requestRevision(project.id, data), {
    invalidate: FINANCE_KEYS, success: 'Budget revision requested - waiting for administrator approval', onSuccess: onClose,
  });

  function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!form.amount || Number(form.amount) === 0) found.amount = 'Enter a non-zero amount (negative to reduce the budget)';
    if (form.reason.trim().length < 5) found.reason = 'Give a reason (5+ characters)';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate(
      { amount: Number(form.amount), reason: form.reason.trim(), changeRequestId: form.changeRequestId ? Number(form.changeRequestId) : null },
      { onError: (err) => setErrors(fieldErrorsFrom(err)) },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request budget revision"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="rev-form" loading={save.isPending}>Submit request</Button></>}
    >
      <form id="rev-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextInput id="rev-amount" label="Change in budget (AED)" type="number" step="1000" required value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount} hint="Use a negative number to reduce the budget." />
        <TextArea id="rev-reason" label="Reason" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={errors.reason} />
        <SelectInput id="rev-cr" label="Linked approved change request (optional)" placeholder="None" value={form.changeRequestId}
          onChange={(e) => setForm({ ...form, changeRequestId: e.target.value })} error={errors.changeRequestId}
          options={approvedChangeRequests.map((cr) => ({ value: cr.id, label: `CR-${cr.id}: ${cr.title}` }))}
          hint="Approving a change request never changes the budget by itself - this link makes the connection explicit." />
      </form>
    </Modal>
  );
}

// ---------- Monthly forecasts ----------
export function ForecastModal({ project, forecasts, reportingDate, onClose }) {
  // Months from the month after the reporting date until the project end month.
  const months = [];
  const start = new Date(`${reportingDate.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() + 1);
  for (let d = start; d.toISOString().slice(0, 7) <= project.end_date.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
    months.push(d.toISOString().slice(0, 10));
  }
  const existing = Object.fromEntries(forecasts.map((f) => [f.month, f.amount]));
  const [values, setValues] = useState(Object.fromEntries(months.map((m) => [m, existing[m] ?? ''])));

  const save = useApiMutation((items) => financeApi.saveForecasts(project.id, items), {
    invalidate: FINANCE_KEYS, success: 'Forecast saved - EAC recalculated', onSuccess: onClose,
  });
  const total = Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0);

  function handleSubmit(e) {
    e.preventDefault();
    const items = months.filter((m) => values[m] !== '').map((m) => ({ month: m, amount: Number(values[m]) }));
    if (items.some((i) => Number.isNaN(i.amount) || i.amount < 0)) return;
    if (items.length) save.mutate(items);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Monthly forecast (future spend)"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="fc-form" loading={save.isPending} disabled={!months.length}>Save forecast</Button></>}
    >
      {months.length === 0 ? (
        <p className="text-sm text-slate-600">The project ends before the next month - there is nothing left to forecast.</p>
      ) : (
        <form id="fc-form" onSubmit={handleSubmit} className="space-y-2">
          {months.map((m) => (
            <label key={m} className="flex items-center justify-between gap-3 text-sm">
              <span className="w-24 text-slate-700">{new Date(`${m}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
              <input type="number" min="0" step="1000" value={values[m]} onChange={(e) => setValues({ ...values, [m]: e.target.value })}
                className="w-40 rounded-md border border-slate-300 px-2 py-1 text-right text-sm" aria-label={`Forecast for ${m}`} />
            </label>
          ))}
          <p className="border-t border-slate-100 pt-2 text-right text-sm font-medium">Forecast to complete: {formatAED(total)}</p>
        </form>
      )}
    </Modal>
  );
}
