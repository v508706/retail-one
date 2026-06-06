import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/db.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();
const now = () => new Date().toISOString();

function buildPermissions(db, tenantId, userId) {
  const rows = db.prepare(`
    SELECT rp.module, rp.can_view, rp.can_create, rp.can_edit, rp.can_share, rp.can_delete
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.tenant_id = ur.tenant_id
    WHERE ur.user_id=? AND ur.tenant_id=?
  `).all(userId, tenantId);

  const perms = {};
  for (const r of rows) {
    if (!perms[r.module]) perms[r.module] = {};
    // OR across roles
    perms[r.module].can_view = (perms[r.module].can_view || r.can_view) ? 1 : 0;
    perms[r.module].can_create = (perms[r.module].can_create || r.can_create) ? 1 : 0;
    perms[r.module].can_edit = (perms[r.module].can_edit || r.can_edit) ? 1 : 0;
    perms[r.module].can_share = (perms[r.module].can_share || r.can_share) ? 1 : 0;
    perms[r.module].can_delete = (perms[r.module].can_delete || r.can_delete) ? 1 : 0;
  }
  return perms;
}

function issueTokens(db, user, tenantId) {
  const permissions = buildPermissions(db, tenantId, user.id);
  const firm = db.prepare(`SELECT id FROM firms WHERE tenant_id=? AND deleted_at IS NULL LIMIT 1`).get(tenantId);

  const payload = {
    sub: user.id,
    tenant_id: tenantId,
    firm_id: firm?.id,
    name: user.name,
    email: user.email,
    permissions,
  };
  const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  const refresh_token = jwt.sign({ sub: user.id, tenant_id: tenantId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
  return { access_token, refresh_token, user: { id: user.id, name: user.name, email: user.email, permissions } };
}

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { email, phone, password, tenant_slug } = req.body;
  if (!password || (!email && !phone)) {
    return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'email/phone and password required' } });
  }
  const db = getDb();

  const tenant = db.prepare(`SELECT * FROM tenants WHERE slug=? AND status='active'`).get(tenant_slug || 'demo');
  if (!tenant) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });

  const user = email
    ? db.prepare(`SELECT * FROM users WHERE email=? AND tenant_id=? AND status='active'`).get(email, tenant.id)
    : db.prepare(`SELECT * FROM users WHERE phone=? AND tenant_id=? AND status='active'`).get(phone, tenant.id);

  if (!user || !bcrypt.compareSync(password, user.password_hash || '')) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid credentials' } });
  }

  res.json({ data: issueTokens(db, user, tenant.id) });
});

// POST /api/v1/auth/refresh
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'refresh_token required' } });
  try {
    const payload = jwt.verify(refresh_token, JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error();
    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE id=? AND status='active'`).get(payload.sub);
    if (!user) throw new Error();
    res.json({ data: issueTokens(db, user, payload.tenant_id) });
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid refresh token' } });
  }
});

// POST /api/v1/auth/otp/request
router.post('/otp/request', (req, res) => {
  const { phone, tenant_slug } = req.body;
  if (!phone) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'phone required' } });
  const db = getDb();
  const tenant = db.prepare(`SELECT * FROM tenants WHERE slug=?`).get(tenant_slug || 'demo');
  if (!tenant) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const user = db.prepare(`SELECT * FROM users WHERE phone=? AND tenant_id=?`).get(phone, tenant.id);
  if (user) {
    db.prepare(`UPDATE users SET otp_code=?, otp_expires_at=? WHERE id=?`).run(otp, expires, user.id);
  } else {
    db.prepare(`INSERT INTO users(id,tenant_id,name,phone,otp_code,otp_expires_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'pending',?,?)`
    ).run(crypto.randomUUID(), tenant.id, phone, phone, otp, expires, now(), now());
  }

  // In production: send SMS. In dev: return OTP in response.
  res.json({ data: { message: 'OTP sent', otp_dev: otp } });
});

// POST /api/v1/auth/otp/verify
router.post('/otp/verify', (req, res) => {
  const { phone, otp, tenant_slug } = req.body;
  if (!phone || !otp) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'phone and otp required' } });
  const db = getDb();
  const tenant = db.prepare(`SELECT * FROM tenants WHERE slug=?`).get(tenant_slug || 'demo');
  if (!tenant) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });

  const user = db.prepare(`SELECT * FROM users WHERE phone=? AND tenant_id=? AND otp_code=?`).get(phone, tenant.id, otp);
  if (!user || new Date(user.otp_expires_at) < new Date()) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired OTP' } });
  }
  db.prepare(`UPDATE users SET otp_code=NULL, otp_expires_at=NULL, status='active', updated_at=? WHERE id=?`).run(now(), user.id);
  res.json({ data: issueTokens(db, user, tenant.id) });
});

export default router;

