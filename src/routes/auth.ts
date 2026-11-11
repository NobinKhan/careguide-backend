import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../validate';
import { UserModel } from '../models/User';
import { requireAuth, signToken, type AppVariables } from '../middleware/auth';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password must be 128 characters or less'),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required').max(128),
});

// shortcut: in-memory, single instance
const loginThrottleMap = new Map<string, { count: number; until: number }>();

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
  .post('/register', validate('json', registerSchema), async (c) => {
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
  .post('/login', validate('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    const now = Date.now();
    const throttle = loginThrottleMap.get(email);
    if (throttle && throttle.until > now && throttle.count >= 5) {
      return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    }

    // Uses Index 1: { email: 1 } unique index for O(log N) lookup
    const userDoc = await UserModel.findOne({ email });
    const isThrottleActive = throttle && throttle.until > now;
    const currentCount = isThrottleActive ? throttle.count : 0;

    if (!userDoc) {
      loginThrottleMap.set(email, { count: currentCount + 1, until: now + 15 * 60 * 1000 });
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const valid = await Bun.password.verify(password, userDoc.passwordHash);
    if (!valid) {
      loginThrottleMap.set(email, { count: currentCount + 1, until: now + 15 * 60 * 1000 });
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    loginThrottleMap.delete(email);

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
