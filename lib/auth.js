// lib/auth.js
import { jwt } from './deps.js';
import dotenv from 'dotenv';

dotenv.config();

export function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload; // { id, email, role, name }
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  const user = authenticate(req);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return null;
  }
  if (!['SUPER_ADMIN', 'ADMIN', 'EDITOR'].includes(user.role)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return null;
  }
  return user;
}
