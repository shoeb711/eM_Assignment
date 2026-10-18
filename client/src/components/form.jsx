// Form controls with a label, required marker and error message.
// The label is linked to the input (htmlFor/id) so it is clickable and screen-reader friendly.

const INPUT_CLASS =
  'block w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50';

function borderClass(error) {
  return error ? 'border-red-400' : 'border-slate-300';
}

export function Field({ id, label, required, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function TextInput({ id, label, required, error, hint, className, ...props }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className={`${INPUT_CLASS} ${borderClass(error)}`} {...props} />
    </Field>
  );
}

export function TextArea({ id, label, required, error, hint, className, rows = 3, ...props }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <textarea id={id} rows={rows} aria-invalid={!!error} className={`${INPUT_CLASS} ${borderClass(error)}`} {...props} />
    </Field>
  );
}

// options: [{ value, label }]
export function SelectInput({ id, label, required, error, hint, className, options, placeholder, ...props }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <select id={id} aria-invalid={!!error} className={`${INPUT_CLASS} ${borderClass(error)} bg-white`} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

// Compact select for filter bars (label hidden visually but kept for screen readers)
export function FilterSelect({ label, value, onChange, options, allLabel = 'All' }) {
  return (
    <label className="inline-flex flex-col text-xs text-slate-500">
      <span className="mb-1">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export const toOptions = (values, labelFn = (v) => v) => values.map((v) => ({ value: v, label: labelFn(v) }));
