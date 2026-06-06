import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const now = () => new Date().toISOString();

// â”€â”€ FIRM SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/firms', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM firms WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`).all(t) });
});

router.post('/firms', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, gstin, state, state_code, address, phone, email, currency = 'INR', decimals = 2, fy_start_month = 4 } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO firms(id,tenant_id,name,gstin,state,state_code,address,phone,email,currency,decimals,fy_start_month,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, name, gstin || null, state || null, state_code || null, address || null, phone || null, email || null, currency, decimals, fy_start_month, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM firms WHERE id=?`).get(id) });
});

router.put('/firms/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, gstin, state, state_code, address, phone, email, currency, decimals, fy_start_month, logo_url } = req.body;
  db.prepare(`UPDATE firms SET name=?,gstin=?,state=?,state_code=?,address=?,phone=?,email=?,currency=?,decimals=?,fy_start_month=?,logo_url=?,updated_at=?,version=version+1 WHERE id=? AND tenant_id=?`
  ).run(name, gstin || null, state || null, state_code || null, address || null, phone || null, email || null, currency || 'INR', decimals || 2, fy_start_month || 4, logo_url || null, now(), req.params.id, t);
  res.json({ data: db.prepare(`SELECT * FROM firms WHERE id=?`).get(req.params.id) });
});

// â”€â”€ STORES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/stores', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM stores WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`).all(t) });
});

router.post('/stores', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, name, address } = req.body;
  if (!firm_id || !name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id and name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO stores(id,tenant_id,firm_id,name,address,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,1)`
  ).run(id, t, firm_id, name, address || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM stores WHERE id=?`).get(id) });
});

// â”€â”€ TERMINALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/terminals', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM terminals WHERE tenant_id=? ORDER BY name`).all(t) });
});

router.post('/terminals', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { store_id, name, doc_prefix = 'T1' } = req.body;
  if (!store_id || !name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'store_id and name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO terminals(id,tenant_id,store_id,name,doc_prefix,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`
  ).run(id, t, store_id, name, doc_prefix, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM terminals WHERE id=?`).get(id) });
});

// â”€â”€ GENERIC SETTINGS (scope-based) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/settings/:scope', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const firm_id = req.query.firm_id || null;
  const row = db.prepare(`SELECT * FROM settings WHERE tenant_id=? AND firm_id IS ? AND scope=?`).get(t, firm_id, req.params.scope);
  res.json({ data: row ? JSON.parse(row.data) : {} });
});

router.put('/settings/:scope', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const firm_id = req.query.firm_id || null;
  const existing = db.prepare(`SELECT * FROM settings WHERE tenant_id=? AND firm_id IS ? AND scope=?`).get(t, firm_id, req.params.scope);
  if (existing) {
    db.prepare(`UPDATE settings SET data=?,updated_at=? WHERE id=?`).run(JSON.stringify(req.body), now(), existing.id);
  } else {
    db.prepare(`INSERT INTO settings(id,tenant_id,firm_id,scope,data,updated_at) VALUES(?,?,?,?,?,?)`
    ).run(crypto.randomUUID(), t, firm_id, req.params.scope, JSON.stringify(req.body), now());
  }
  res.json({ data: req.body });
});

// â”€â”€ USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/users', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.status, GROUP_CONCAT(r.name) as roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id AND ur.tenant_id=u.tenant_id LEFT JOIN roles r ON r.id=ur.role_id WHERE u.tenant_id=? GROUP BY u.id ORDER BY u.name`).all(t);
  res.json({ data: rows });
});

router.post('/users', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, email, phone, password, role_id } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  const hash = password ? bcrypt.hashSync(password, 10) : null;
  db.prepare(`INSERT INTO users(id,tenant_id,name,email,phone,password_hash,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?)`
  ).run(id, t, name, email || null, phone || null, hash, now(), now());
  if (role_id) db.prepare(`INSERT INTO user_roles(id,tenant_id,user_id,role_id) VALUES(?,?,?,?)`).run(crypto.randomUUID(), t, id, role_id);
  res.status(201).json({ data: db.prepare(`SELECT id, name, email, phone, status FROM users WHERE id=?`).get(id) });
});

// â”€â”€ ROLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/roles', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM roles WHERE tenant_id=? ORDER BY name`).all(t) });
});

router.put('/roles/:id/permissions', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { permissions } = req.body; // { module: { can_view, can_create, ... } }
  for (const [module, perms] of Object.entries(permissions)) {
    const existing = db.prepare(`SELECT * FROM role_permissions WHERE role_id=? AND module=? AND tenant_id=?`).get(req.params.id, module, t);
    if (existing) {
      db.prepare(`UPDATE role_permissions SET can_view=?,can_create=?,can_edit=?,can_share=?,can_delete=? WHERE id=?`
      ).run(perms.can_view ? 1 : 0, perms.can_create ? 1 : 0, perms.can_edit ? 1 : 0, perms.can_share ? 1 : 0, perms.can_delete ? 1 : 0, existing.id);
    } else {
      db.prepare(`INSERT INTO role_permissions(id,tenant_id,role_id,module,can_view,can_create,can_edit,can_share,can_delete) VALUES(?,?,?,?,?,?,?,?,?)`
      ).run(crypto.randomUUID(), t, req.params.id, module, perms.can_view ? 1 : 0, perms.can_create ? 1 : 0, perms.can_edit ? 1 : 0, perms.can_share ? 1 : 0, perms.can_delete ? 1 : 0);
    }
  }
  const updated = db.prepare(`SELECT * FROM role_permissions WHERE role_id=? AND tenant_id=?`).all(req.params.id, t);
  res.json({ data: updated });
});

// â”€â”€ INVOICE TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/invoice-templates', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM invoice_templates WHERE tenant_id=? ORDER BY is_default DESC, name`).all(t) });
});

router.post('/invoice-templates', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, name, doc_type = 'invoice', layout = 'a4', theme_color = '#1a56db', show_logo = 1, show_signature = 0, header_note, footer_note, terms, is_default = 0 } = req.body;
  if (!firm_id || !name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id and name required' } });
  if (is_default) db.prepare(`UPDATE invoice_templates SET is_default=0 WHERE tenant_id=? AND firm_id=?`).run(t, firm_id);
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO invoice_templates(id,tenant_id,firm_id,name,doc_type,layout,theme_color,show_logo,show_signature,header_note,footer_note,terms,is_default,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, t, firm_id, name, doc_type, layout, theme_color, show_logo ? 1 : 0, show_signature ? 1 : 0, header_note || null, footer_note || null, terms || null, is_default ? 1 : 0, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM invoice_templates WHERE id=?`).get(id) });
});

export default router;

