export function getUser() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    // JWT uses URL-safe base64 (- and _); atob() needs standard base64 (+ and /)
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export function getFirmId() {
  return getUser()?.firm_id || '';
}

export function canDo(module, action = 'view') {
  const perms = getUser()?.permissions || {};
  return !!perms[module]?.[`can_${action}`];
}

export function logout() {
  localStorage.clear();
  window.location.href = '/login';
}
