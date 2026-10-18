// Reusable table with sortable headers, row click and pagination.
//
// columns: [{ key, label, sortKey?, render?(row), className? }]
// sort/order + onSort: controlled sorting (sorting happens on the server)
import { EmptyState } from './ui.jsx';

export function DataTable({ columns, rows, sort, order, onSort, onRowClick, emptyMessage, rowClassName }) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  function headerClick(col) {
    if (!col.sortKey || !onSort) return;
    const nextOrder = sort === col.sortKey && order === 'asc' ? 'desc' : 'asc';
    onSort(col.sortKey, nextOrder);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((col) => (
              <th key={col.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${col.className || ''}`}
                aria-sort={sort === col.sortKey ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>
                {col.sortKey && onSort ? (
                  <button type="button" onClick={() => headerClick(col)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800">
                    {col.label}
                    <span aria-hidden className="text-[10px]">{sort === col.sortKey ? (order === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                ) : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={`border-b border-slate-100 ${onRowClick ? 'cursor-pointer hover:bg-slate-50 focus:bg-indigo-50 focus:outline-none' : ''} ${rowClassName?.(row) || ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2.5 align-middle ${col.className || ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>{total} record{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
