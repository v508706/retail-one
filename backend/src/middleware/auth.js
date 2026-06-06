import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'retailone-dev-secret-change-in-prod';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Bearer token required' } });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.user = payload;
    req.tenantId = payload.tenant_id;
    next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token' } });
  }
}

export function requirePerm(module, action) {
  return (req, res, next) => {
    const perms = req.user?.permissions || {};
    const mod = perms[module];
    if (!mod || !mod[`can_${action}`]) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: `${action} on ${module} not permitted` } });
    }
    next();
  };
}
