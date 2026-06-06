import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

// Attach token from localStorage
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-refresh on 401
api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const refresh_token = localStorage.getItem('refresh_token');
      if (refresh_token) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token });
          localStorage.setItem('access_token', data.data.access_token);
          err.config.headers.Authorization = `Bearer ${data.data.access_token}`;
          return api(err.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── helpers ──────────────────────────────────────────────────────
export const fmt = {
  currency: (n, dec = 2) => `₹${(+n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`,
  number: (n) => (+n || 0).toLocaleString('en-IN'),
  date: (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  percent: (n) => `${(+n || 0).toFixed(1)}%`,
};

export function errorMsg(err) {
  return err?.response?.data?.error?.message || err?.message || 'Something went wrong';
}
