const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && onUnauthorized) onUnauthorized();

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/me"),
  changePassword: (currentPassword, newPassword) =>
    request("/api/me/password", { method: "PUT", body: { currentPassword, newPassword } }),

  departments: () => request("/api/departments"),
  categories: () => request("/api/categories"),
  deptStaff: (deptId, role) =>
    request(`/api/departments/${deptId}/staff${role ? `?role=${encodeURIComponent(role)}` : ""}`),

  listRequests: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
    ).toString();
    return request(`/api/requests${qs ? `?${qs}` : ""}`);
  },
  createRequest: (payload) => request("/api/requests", { method: "POST", body: payload }),
  getRequest: (id) => request(`/api/requests/${id}`),

  submit: (id) => request(`/api/requests/${id}/submit`, { method: "POST" }),
  beginReview: (id) => request(`/api/requests/${id}/begin-review`, { method: "POST" }),
  accept: (id, handlerId) =>
    request(`/api/requests/${id}/accept`, { method: "POST", body: { handlerId } }),
  reject: (id, reason) =>
    request(`/api/requests/${id}/reject`, { method: "POST", body: { reason } }),
  complete: (id, notes) =>
    request(`/api/requests/${id}/complete`, { method: "POST", body: { notes } }),
  confirmClose: (id) => request(`/api/requests/${id}/confirm-close`, { method: "POST" }),
  reopen: (id, reason) =>
    request(`/api/requests/${id}/reopen`, { method: "POST", body: { reason } }),

  addComment: (id, message) =>
    request(`/api/requests/${id}/comments`, { method: "POST", body: { message } }),

  notifications: () => request("/api/notifications"),
  markAllNotificationsRead: () => request("/api/notifications/read-all", { method: "POST" }),

  listUsers: () => request("/api/users"),
  createUser: (payload) => request("/api/users", { method: "POST", body: payload }),
  updateUser: (id, payload) => request(`/api/users/${id}`, { method: "PATCH", body: payload }),

  createDepartment: (payload) => request("/api/departments", { method: "POST", body: payload }),
  updateDepartment: (id, payload) => request(`/api/departments/${id}`, { method: "PATCH", body: payload }),

  createCategory: (name) => request("/api/categories", { method: "POST", body: { name } }),
  deleteCategory: (name) => request(`/api/categories/${encodeURIComponent(name)}`, { method: "DELETE" }),

  reportsSummary: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request(`/api/reports/summary${qs ? `?${qs}` : ""}`);
  },
};
