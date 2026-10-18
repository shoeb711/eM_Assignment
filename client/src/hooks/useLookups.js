// Reference lists (departments, users, cost categories) used by dropdowns and filters.
// Loaded once and cached.
import { useQuery } from '@tanstack/react-query';
import { lookupsApi } from '../api/endpoints.js';

export function useLookups() {
  const query = useQuery({ queryKey: ['lookups'], queryFn: lookupsApi.get, staleTime: Infinity });
  const data = query.data || { departments: [], users: [], costCategories: [] };
  return {
    ...data,
    isLoading: query.isLoading,
    managers: data.users.filter((u) => u.role === 'PROJECT_MANAGER' || u.role === 'ADMIN'),
    userName: (id) => data.users.find((u) => u.id === Number(id))?.full_name,
  };
}
