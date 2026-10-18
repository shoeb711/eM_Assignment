// Every backend endpoint the app uses, grouped by module.
// Pages never build URLs themselves - they call these functions.
import { apiFetch, toQueryString } from './client.js';

export const authApi = {
  me: () => apiFetch('/auth/me'),
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

export const lookupsApi = {
  get: () => apiFetch('/lookups'),
};

export const projectsApi = {
  list: (params) => apiFetch(`/projects${toQueryString(params)}`),
  get: (id) => apiFetch(`/projects/${id}`),
  create: (data) => apiFetch('/projects', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/projects/${id}`, { method: 'PUT', body: data }),
};

export const tasksApi = {
  list: (params) => apiFetch(`/tasks${toQueryString(params)}`),
  create: (projectId, data) => apiFetch(`/projects/${projectId}/tasks`, { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/tasks/${id}`, { method: 'PUT', body: data }),
};

export const milestonesApi = {
  list: (params) => apiFetch(`/milestones${toQueryString(params)}`),
  create: (projectId, data) => apiFetch(`/projects/${projectId}/milestones`, { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/milestones/${id}`, { method: 'PUT', body: data }),
};

export const risksApi = {
  list: (params) => apiFetch(`/risks${toQueryString(params)}`),
  create: (projectId, data) => apiFetch(`/projects/${projectId}/risks`, { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/risks/${id}`, { method: 'PUT', body: data }),
};

export const changeRequestsApi = {
  list: (params) => apiFetch(`/change-requests${toQueryString(params)}`),
  get: (id) => apiFetch(`/change-requests/${id}`),
  submit: (projectId, data) => apiFetch(`/projects/${projectId}/change-requests`, { method: 'POST', body: data }),
  decide: (id, data) => apiFetch(`/change-requests/${id}/decision`, { method: 'POST', body: data }),
  resubmit: (id, data) => apiFetch(`/change-requests/${id}/resubmit`, { method: 'POST', body: data }),
};

export const financeApi = {
  projectSummary: (projectId) => apiFetch(`/projects/${projectId}/finance`),
  listCosts: (params) => apiFetch(`/costs${toQueryString(params)}`),
  // idempotencyKey: generated once per form submission, so a double click can't create two costs
  createCost: (projectId, data, idempotencyKey) =>
    apiFetch(`/projects/${projectId}/costs`, { method: 'POST', body: data, headers: { 'Idempotency-Key': idempotencyKey } }),
  postCost: (costId) => apiFetch(`/costs/${costId}/post`, { method: 'POST' }),
  deleteCost: (costId) => apiFetch(`/costs/${costId}`, { method: 'DELETE' }),
  requestRevision: (projectId, data) => apiFetch(`/projects/${projectId}/budget-revisions`, { method: 'POST', body: data }),
  decideRevision: (revisionId, decision) => apiFetch(`/budget-revisions/${revisionId}/decision`, { method: 'POST', body: { decision } }),
  saveForecasts: (projectId, items) => apiFetch(`/projects/${projectId}/forecasts`, { method: 'PUT', body: { items } }),
};

export const activityApi = {
  notifications: () => apiFetch('/notifications'),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }),
  auditEvents: (params) => apiFetch(`/audit-events${toQueryString(params)}`),
  automationRuns: () => apiFetch('/automation-runs'),
  runAutomation: (simulateFailure) => apiFetch('/automation-runs/run', { method: 'POST', body: { simulateFailure } }),
};
