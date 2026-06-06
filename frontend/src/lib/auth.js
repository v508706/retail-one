export function getUser() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
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
