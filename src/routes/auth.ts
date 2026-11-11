import { Hono } from 'hono';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  validate,
  nameSchema,
  emailSchema,
  passwordSchema,
  loginPasswordSchema,
  interestsSchema,
} from '../validate';
import { UserModel } from '../models/User';
import { requireAuth, signToken, type AppVariables } from '../middleware/auth';

const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  interests: interestsSchema.default([]),
});

const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

interface LoginThrottleDoc {
  _id: string;
  count: number;
  until: number;
}

const getLoginThrottleCollection = () =>
  mongoose.connection.collection<LoginThrottleDoc>('login_throttles');

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
    const throttleKey = `login-throttle:${email}`;
    const throttleCol = getLoginThrottleCollection();

    // Uses MongoDB built-in _id_ index (zero custom index overhead, shared across processes)
    const throttle = await throttleCol.findOne({ _id: throttleKey });
    if (throttle && throttle.until > now && throttle.count >= 5) {
      return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    }

    // Uses Index 1: { email: 1 } unique index for O(log N) lookup
    const userDoc = await UserModel.findOne({ email });
    const isThrottleActive = Boolean(throttle && throttle.until > now);
    const currentCount = isThrottleActive ? throttle!.count : 0;

    if (!userDoc) {
      await throttleCol.updateOne(
        { _id: throttleKey },
        { $set: { count: currentCount + 1, until: now + 15 * 60 * 1000 } },
        { upsert: true }
      );
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const valid = await Bun.password.verify(password, userDoc.passwordHash);
    if (!valid) {
      await throttleCol.updateOne(
        { _id: throttleKey },
        { $set: { count: currentCount + 1, until: now + 15 * 60 * 1000 } },
        { upsert: true }
      );
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    await throttleCol.deleteOne({ _id: throttleKey });

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
