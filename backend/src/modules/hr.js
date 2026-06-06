import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { paginate, paginatedResponse } from '../middleware/tenant.js';

const router = Router();
const now = () => new Date().toISOString();

router.get('/staff', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const total = db.prepare(`SELECT COUNT(*) as n FROM staff WHERE tenant_id=? AND deleted_at IS NULL`).get(t).n;
  const rows = db.prepare(`SELECT * FROM staff WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name LIMIT ? OFFSET ?`).all(t, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

router.get('/staff/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const staff = db.prepare(`SELECT * FROM staff WHERE id=? AND tenant_id=? AND deleted_at IS NULL`).get(req.params.id, t);
  if (!staff) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Staff not found' } });
  const profile = db.prepare(`SELECT * FROM staff_profiles WHERE staff_id=? AND tenant_id=?`).get(req.params.id, t);
  res.json({ data: { ...staff, profile } });
});

router.post('/staff', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, name, designation, department, gender, blood_group, national_id, dob, doj, nationality, photo_url, phone, user_id } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO staff(id,tenant_id,firm_id,name,designation,department,gender,blood_group,national_id,dob,doj,nationality,photo_url,phone,user_id,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, firm_id || null, name, designation || null, department || null, gender || null, blood_group || null, national_id || null, dob || null, doj || null, nationality || null, photo_url || null, phone || null, user_id || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM staff WHERE id=?`).get(id) });
});

router.put('/staff/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, designation, department, gender, blood_group, dob, doj, phone } = req.body;
  db.prepare(`UPDATE staff SET name=?,designation=?,department=?,gender=?,blood_group=?,dob=?,doj=?,phone=?,updated_at=?,version=version+1 WHERE id=? AND tenant_id=?`
  ).run(name, designation || null, department || null, gender || null, blood_group || null, dob || null, doj || null, phone || null, now(), req.params.id, t);
  res.json({ data: db.prepare(`SELECT * FROM staff WHERE id=?`).get(req.params.id) });
});

router.delete('/staff/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  db.prepare(`UPDATE staff SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`).run(now(), now(), req.params.id, t);
  res.json({ data: { deleted: true } });
});

export default router;

