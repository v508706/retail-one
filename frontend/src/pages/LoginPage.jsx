import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errorMsg } from '../lib/api.js';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@demo.com', password: 'admin123', tenant_slug: 'demo' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('access_token', data.data.access_token);
      localStorage.setItem('refresh_token', data.data.refresh_token);
      navigate('/dashboard');
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1a3a6e 0%,#1a56db 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: '#1a56db', borderRadius: 12, marginBottom: 12 }}>
            <Zap size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111928' }}>RetailOne</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Retail & Wholesale Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Business Slug</label>
            <input className="form-control" type="text" value={form.tenant_slug}
              onChange={e => setForm(f => ({ ...f, tenant_slug: e.target.value }))} required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop: 6, justifyContent: 'center', padding: '10px' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 12, background: '#f0f4ff', borderRadius: 8, fontSize: 12, color: '#4b5563' }}>
          <strong>Demo credentials:</strong><br />
          Email: admin@demo.com<br />
          Password: admin123 / Slug: demo
        </div>
      </div>
    </div>
  );
}
