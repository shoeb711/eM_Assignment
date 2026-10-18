// TanStack Query keeps server data in a cache and refetches it when we "invalidate" a key.
// After every save we invalidate the related keys, so lists, details and the dashboard
// reload FROM THE SERVER - the UI never patches numbers by itself.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => error?.status >= 500 && failureCount < 2, // never retry 4xx
      refetchOnWindowFocus: false,
    },
  },
});
