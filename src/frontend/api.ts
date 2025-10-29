export interface ApiResponse<T> {
  data?: T;
  code?: string;
  message?: string;
}

function getToken() {
  return localStorage.getItem('token') || '';
}

export async function api<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  return body as ApiResponse<T>;
}