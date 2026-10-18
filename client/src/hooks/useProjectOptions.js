// All projects the user can see, as dropdown options for filters.
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/endpoints.js';

export function useProjectOptions() {
  const query = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () => projectsApi.list({ pageSize: 100, sort: 'code' }),
    staleTime: 60_000,
  });
  return (query.data?.items || []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));
}
