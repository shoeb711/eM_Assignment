// Small reusable building blocks used on every page.
import { useEffect, useRef } from 'react';
import { humanize } from '../utils/format.js';

// ---------- Buttons ----------
const BUTTON_STYLES = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  ghost: 'text-indigo-700 hover:bg-indigo-50',
};

export function Button({ variant = 'primary', size = 'md', className = '', loading = false, children, ...props }) {
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm' };
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
        disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

// ---------- Status badges ----------
const BADGE_COLORS = {
  // project / generic
  ACTIVE: 'bg-blue-100 text-blue-800', PLANNING: 'bg-slate-100 text-slate-700', ON_HOLD: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-slate-200 text-slate-600',
  // tasks
  TODO: 'bg-slate-100 text-slate-700', IN_PROGRESS: 'bg-blue-100 text-blue-800', BLOCKED: 'bg-red-100 text-red-800', DONE: 'bg-emerald-100 text-emerald-800',
  // milestones
  PLANNED: 'bg-slate-100 text-slate-700', ACHIEVED: 'bg-emerald-100 text-emerald-800', MISSED: 'bg-red-100 text-red-800',
  // risks
  OPEN: 'bg-red-100 text-red-800', MITIGATING: 'bg-amber-100 text-amber-800', CLOSED: 'bg-slate-100 text-slate-600',
  // change requests / revisions
  SUBMITTED: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-purple-100 text-purple-800', PENDING: 'bg-amber-100 text-amber-800',
  // automation runs
  SUCCESS: 'bg-emerald-100 text-emerald-800', FAILED: 'bg-red-100 text-red-800', RUNNING: 'bg-blue-100 text-blue-800',
  // costs
  DRAFT: 'bg-slate-100 text-slate-700', POSTED: 'bg-emerald-100 text-emerald-800',
  // priority
  LOW: 'bg-slate-100 text-slate-600', MEDIUM: 'bg-sky-100 text-sky-800', HIGH: 'bg-orange-100 text-orange-800', CRITICAL: 'bg-red-600 text-white',
};

export function Badge({ value, className = '' }) {
  if (!value) return null;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[value] || 'bg-slate-100 text-slate-700'} ${className}`}>
      {humanize(value)}
    </span>
  );
}

// Risk score: colour by exposure (>= 15 is high)
export function ScoreBadge({ score }) {
  const color = score >= 15 ? 'bg-red-600 text-white' : score >= 8 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${color}`} title="Probability × Impact">{score}</span>;
}

export function ProgressBar({ value, className = '' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 w-full min-w-16 rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-slate-600">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ---------- Page structure ----------
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            active === tab.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Loading / empty / error states ----------
export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ message = 'Nothing to show yet.' }) {
  return <p className="py-10 text-center text-sm text-slate-500">{message}</p>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <p className="font-medium">Could not load this data.</p>
      <p className="mt-1">{error?.message}</p>
      {error?.requestId && <p className="mt-1 text-xs opacity-75">Request ID: {error.requestId}</p>}
      {onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// Renders loading / error states for a TanStack query, otherwise the children.
export function QueryState({ query, children }) {
  if (query.isLoading) return <Spinner />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return children(query.data);
}

// ---------- Modal ----------
export function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // move keyboard focus into the dialog
    const first = dialogRef.current?.querySelector('input, select, textarea, button');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`w-full ${widths[size]} rounded-lg bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 id="modal-title" className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Close">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// Asks "are you sure?" before consequential actions (post a cost, approve, ...).
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'primary', loading, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="text-sm text-slate-700">{message}</p>
    </Modal>
  );
}

// Key/value line used on detail views
export function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}
