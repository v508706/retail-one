// Tenant-scoped query helpers — every DB access goes through these
export function tenantScope(db, tenantId) {
  return {
    get: (table, id) =>
      db.prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=? AND (deleted_at IS NULL OR 1=0)`).get(id, tenantId),

    all: (table, where = '', params = []) =>
      db.prepare(`SELECT * FROM ${table} WHERE tenant_id=? ${where} ORDER BY created_at DESC`).all(tenantId, ...params),

    insert: (table, data) => {
      const keys = Object.keys(data);
      const placeholders = keys.map(() => '?').join(',');
      return db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${placeholders})`).run(...Object.values(data));
    },

    update: (table, id, data) => {
      const sets = Object.keys(data).map(k => `${k}=?`).join(',');
      return db.prepare(`UPDATE ${table} SET ${sets} WHERE id=? AND tenant_id=?`).run(...Object.values(data), id, tenantId);
    },

    softDelete: (table, id) =>
      db.prepare(`UPDATE ${table} SET deleted_at=? WHERE id=? AND tenant_id=?`).run(new Date().toISOString(), id, tenantId),

    raw: (sql, params = []) => db.prepare(sql).all(...params),
    rawGet: (sql, params = []) => db.prepare(sql).get(...params),
    rawRun: (sql, params = []) => db.prepare(sql).run(...params),
  };
}

export function paginate(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const per_page = Math.min(200, parseInt(req.query.per_page) || 50);
  const offset = (page - 1) * per_page;
  return { page, per_page, offset };
}

export function paginatedResponse(data, total, page, per_page) {
  return { data, meta: { page, per_page, total } };
}
