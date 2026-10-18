// Keeps a list page's filters, sorting and page number in the URL (?status=ACTIVE&page=2).
// Benefits: the browser back button works, and dashboard drill-downs are just links
// like /tasks?overdue=true&departmentId=2.
import { useSearchParams } from 'react-router-dom';

export function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = { ...defaults, ...Object.fromEntries(searchParams) };

  function setParams(changes) {
    const next = { ...Object.fromEntries(searchParams), ...changes };
    if (!('page' in changes)) delete next.page; // any filter change goes back to page 1
    Object.keys(next).forEach((key) => {
      if (next[key] === '' || next[key] === undefined || next[key] === null || next[key] === false) delete next[key];
    });
    setSearchParams(next, { replace: true });
  }

  function clearParams() {
    setSearchParams({}, { replace: true });
  }

  return [params, setParams, clearParams];
}
