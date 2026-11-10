import type { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export type AppVariables = {
  user: AuthUser;
};

const getJwtSecret = (): string =>
  process.env.JWT_SECRET || 'careguide-bd-super-secret-jwt-key-2026';

export async function signToken(user: {
  _id: unknown;
  email: string;
  role: 'user' | 'admin';
}): Promise<string> {
  const payload = {
    sub: String(user._id),
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  return sign(payload, getJwtSecret(), 'HS256');
}

export async function requireAuth(c: Context<{ Variables: AppVariables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Bearer token' }, 401);
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = await verify(token, getJwtSecret(), 'HS256');
    c.set('user', {
      id: String(payload.sub),
      email: String(payload.email),
      role: payload.role === 'admin' ? 'admin' : 'user',
    });
    await next();
  } catch {
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }
}

export async function requireAdmin(c: Context<{ Variables: AppVariables }>, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
  await next();
}
