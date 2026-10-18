// Helpers for list endpoints: building WHERE clauses safely, sorting and pagination.

// Collects filter conditions and their values. "?" becomes the next $n placeholder,
// so user input is always sent as a parameter, never pasted into the SQL.
//   const f = createFilters();
//   f.add('p.status = ?', 'ACTIVE');                        ->  p.status = $1
//   f.add('(p.name ILIKE ? OR p.code ILIKE ?)', '%abc%');    ->  (p.name ILIKE $2 OR p.code ILIKE $2)
export function createFilters() {
  const conditions = [];
  const params = [];
  return {
    params,
    add(sqlWithQuestionMark, value) {
      params.push(value);
      conditions.push(sqlWithQuestionMark.replaceAll('?', `$${params.length}`));
    },
    // A condition with no user-supplied value, e.g. 't.assignee_id IS NULL'.
    addFixed(sql) {
      conditions.push(sql);
    },
    // Adds a value and returns its placeholder, for SQL that needs it in a custom spot.
    param(value) {
      params.push(value);
      return `$${params.length}`;
    },
    where() {
      return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    },
  };
}

// Column names cannot be sent as parameters, so ORDER BY only accepts columns from an allow-list.
export function orderBy(sortKey, direction, allowed, fallback) {
  const column = allowed[sortKey] || allowed[fallback];
  const dir = String(direction).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY ${column} ${dir} NULLS LAST`;
}

export function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, limitSql: `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}` };
}

// Shapes the response for every paginated list.
// Rows use "COUNT(*) OVER() AS total_count" to get the full count in the same query.
export function pagedResult(rows, page, pageSize) {
  const total = rows[0]?.total_count ?? 0;
  const items = rows.map(({ total_count, ...row }) => row);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
