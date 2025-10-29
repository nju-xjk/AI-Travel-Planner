export function getToken(): string {
  return localStorage.getItem('token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
  window.dispatchEvent(new Event('auth-changed'));
}

export function clearToken() {
  localStorage.removeItem('token');
  window.dispatchEvent(new Event('auth-changed'));
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 2 ? '==' : base64.length % 4 === 3 ? '=' : '';
  try {
    return atob(base64 + pad);
  } catch {
    return '';
  }
}

export function getEmailFromToken(token?: string): string | null {
  const t = token ?? getToken();
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadStr = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadStr);
    if (typeof payload?.email === 'string') return payload.email;
    return null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}