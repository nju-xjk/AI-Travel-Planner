import { getToken, clearToken } from './auth';

export interface ApiResponse<T> {
  data?: T;
  code?: string;
  message?: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    // token 失效或未授权，清理本地状态并跳到登录页
    clearToken();
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login';
    }
  }
  const body = await res.json().catch(() => ({}));
  return body as ApiResponse<T>;
}