// Wraps every "save" in the app:
//   1. calls the API
//   2. on success: reloads the listed query keys from the server + shows a success toast
//   3. on failure: shows the server's error message (forms also read error.details for field errors)
//
// Usage:
//   const save = useApiMutation((data) => tasksApi.update(id, data), {
//     invalidate: ['tasks', 'project', 'dashboard'], success: 'Task saved',
//   });
//   save.mutate(formData)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast.jsx';

export function useApiMutation(mutationFn, { invalidate = [], success, onSuccess } = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      if (success) toast.success(typeof success === 'function' ? success(data) : success);
      onSuccess?.(data, variables);
    },
    onError: (error) => toast.error(error),
  });
}

// Query keys that depend on delivery or finance data. Saving a task, cost, etc.
// refreshes all of them so every screen (including the dashboard) shows the new numbers.
export const DELIVERY_KEYS = ['tasks', 'milestones', 'risks', 'project', 'projects', 'dashboard'];
export const FINANCE_KEYS = ['finance', 'costs', 'project', 'projects', 'dashboard', 'audit'];
