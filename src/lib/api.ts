import type { Pagination } from './types';

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'sabino-control.token';

// sessionStorage on purpose: the session ends when the tab closes. This console
// can see every school, so it should not stay signed in on a shared machine.
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

let onAuthLost: () => void = () => {};
export const setAuthLostHandler = (fn: () => void) => { onAuthLost = fn; };

interface Opts { method?: string; body?: unknown; query?: Record<string, string | number | null | undefined> }
export interface ApiResult<T> { data: T; pagination?: Pagination; message?: string }

export async function api<T>(path: string, { method = 'GET', body, query }: Opts = {}): Promise<ApiResult<T>> {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)); });
  const qs = params.toString() ? `?${params}` : '';
  const token = tokenStore.get();

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/superadmin${path}${qs}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Can’t reach the server. Check your connection and the VITE_API_URL setting.', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    if (res.status === 401 && token && path !== '/auth/login') onAuthLost();
    const fallback = res.status === 404
      ? 'The server has no route for this request (404). Your backend is probably out of date: replace the files in routes/superadmin with the latest version and redeploy.'
      : `Request failed (${res.status}).`;
    throw new ApiError(json?.error || fallback, res.status, json?.code);
  }
  if (json === null) {
    throw new ApiError('The server sent a reply the console can’t read. Check that VITE_API_URL points at your backend.', res.status);
  }
  return json as ApiResult<T>;
}
