import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { UserModel } from '../models/User';
import { requireAuth, signToken, type AppVariables } from '../middleware/auth';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  interests: z.array(z.string().trim().min(1)).optional().default([]),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export function serializeUser(doc: any): UserDTO {
  return {
    _id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    interests: Array.isArray(doc.interests) ? doc.interests : [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

export const authRoutes = new Hono<{ Variables: AppVariables }>()
  .post('/register', zValidator('json', registerSchema), async (c) => {
    const { name, email, password, interests } = c.req.valid('json');

    // Uses Index 1: { email: 1 } unique index
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return c.json({ error: 'Email is already registered' }, 409);
    }

    const passwordHash = await Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: 10,
    });

    const created = await UserModel.create({
      name,
      email,
      passwordHash,
      role: 'user',
      interests: Array.from(new Set(interests.map((i) => i.toLowerCase().trim()).filter(Boolean))),
    });

    const user = serializeUser(created);
    const token = await signToken(created);
    return c.json({ token, user }, 201);
  })
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    // Uses Index 1: { email: 1 } unique index for O(log N) lookup
    const userDoc = await UserModel.findOne({ email });
    if (!userDoc) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const valid = await Bun.password.verify(password, userDoc.passwordHash);
    if (!valid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const user = serializeUser(userDoc);
    const token = await signToken(userDoc);
    return c.json({ token, user });
  })
  .get('/me', requireAuth, async (c) => {
    const authUser = c.get('user');
    // Uses built-in _id_ index
    const userDoc = await UserModel.findById(authUser.id).select('-passwordHash').lean();
    if (!userDoc) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.json({ user: serializeUser(userDoc) });
  });
