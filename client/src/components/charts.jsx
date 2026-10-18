// Shared chart pieces for the dashboard (Recharts).
// Colours come from a validated colour-blind-safe palette, assigned in a fixed order.
// Status colours (good/warning/critical) are reserved for project health and always
// shown together with a text label, never colour alone.
import { useState } from 'react';
import { formatAED, formatAEDShort } from '../utils/format.js';

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a']; // slot 1 blue, 2 orange, 3 aqua
export const STATUS = { GREEN: '#0ca30c', AMBER: '#fab219', RED: '#d03b3b', CLOSED: '#898781' };
export const SEQUENTIAL = ['#f0efec', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']; // light -> dark blue
export const AXIS = { stroke: '#c3c2b7', tick: { fill: '#52514e', fontSize: 11 } };
export const GRID = '#e1e0d9';

// Card that can switch between the chart and a plain table of the same data
// (the table is the accessible / exact-number view of every chart).
export function ChartCard({ title, subtitle, children, table, className = '' }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`min-w-0 rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setShowTable(!showTable)} className="whitespace-nowrap text-xs text-indigo-700 hover:underline">
            {showTable ? 'Show chart' : 'View as table'}
          </button>
        )}
      </div>
      {/* min-w-0 lets the chart shrink/grow with its grid cell (otherwise Recharts measures the wrong width) */}
      <div className="min-w-0 p-4">
        {showTable && table ? (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500">{table.columns.map((c) => <th key={c.key} className="py-1 pr-3">{c.label}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {table.columns.map((c) => <td key={c.key} className="py-1 pr-3 tabular-nums">{c.format ? c.format(row[c.key], row) : row[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : children}
      </div>
    </section>
  );
}

// Tooltip: value first (strong), series name second, keyed with a short line of the series colour.
export function MoneyTooltip({ active, payload, label, hint }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3" style={{ background: p.color }} aria-hidden />
          <span className="font-semibold text-slate-900">{formatAED(p.value)}</span>
          <span className="text-slate-500">{p.name}</span>
        </p>
      ))}
      {hint && <p className="mt-1 text-[11px] text-indigo-700">{hint}</p>}
    </div>
  );
}

export function CountTooltip({ active, payload, label, unit, hint }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-700">{label}</p>
      <p><span className="font-semibold text-slate-900">{payload[0].value}</span> <span className="text-slate-500">{unit}</span></p>
      {hint && <p className="mt-1 text-[11px] text-indigo-700">{hint}</p>}
    </div>
  );
}

export const moneyTick = (v) => formatAEDShort(v).replace('AED ', '');

// Small legend that mirrors the marks (rect for bars, line for lines).
export function Legend({ items }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.line
            ? <span className="inline-block h-0.5 w-4" style={{ background: item.color, borderTop: item.dashed ? `2px dashed ${item.color}` : undefined }} aria-hidden />
            : <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden />}
          {item.label}
        </li>
      ))}
    </ul>
  );
}
