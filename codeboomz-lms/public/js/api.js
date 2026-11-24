const KEY = 'cbz-token';
let token = null;
try { token = localStorage.getItem(KEY); } catch {}

export const auth = {
  get token() { return token; },
  set(t) { token = t; try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch {} },
};

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && path !== '/auth/login') {
    auth.set(null);
    location.hash = '#/login';
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}
export const post = (path, body) => api(path, { method: 'POST', body: body || {} });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
