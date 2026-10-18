// The ONE place that talks to the backend. Every API call goes through apiFetch().
//  - sends/receives JSON
//  - sends the login cookie automatically (same origin thanks to the Vite proxy)
//  - turns error responses into an ApiError with code, message, field details and request ID

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details || [];
    this.requestId = body?.error?.requestId;
  }
}

export async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const hasBody = body !== undefined;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Session expired in the middle of using the app -> tell the AuthProvider to show the login page.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new ApiError(response.status, data);
  }
  return data;
}

// { status: 'ACTIVE', page: 2, search: '' }  ->  '?status=ACTIVE&page=2'   (empty values are skipped)
export function toQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== false) search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

// Server validation errors -> { fieldName: 'message' } for showing under form fields.
export function fieldErrorsFrom(error) {
  const result = {};
  (error?.details || []).forEach((d) => {
    if (d.field) result[d.field] = d.message;
  });
  return result;
}
