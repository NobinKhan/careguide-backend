import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { UserModel } from '../models/User';
import { NoteModel } from '../models/Note';
import { PostModel } from '../models/Post';
import { requireAuth, requireAdmin, type AppVariables } from '../middleware/auth';
import { serializeUser } from './auth';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const updateInterestsSchema = z.object({
  interests: z.array(z.string().trim().min(1)),
});

const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['user', 'admin']).default('user'),
  interests: z.array(z.string().trim().min(1)).default([]),
});

const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['user', 'admin']).optional(),
  interests: z.array(z.string().trim().min(1)).optional(),
});

const deleteUserQuerySchema = z.object({
  keepData: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

export const userRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', requireAuth)
  .patch('/me/interests', zValidator('json', updateInterestsSchema), async (c) => {
    const authUser = c.get('user');
    const { interests } = c.req.valid('json');
    const normalized = Array.from(
      new Set(interests.map((i) => i.toLowerCase().trim()).filter(Boolean))
    );

    // Uses built-in _id_ index
    const updated = await UserModel.findByIdAndUpdate(
      authUser.id,
      { interests: normalized },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!updated) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: serializeUser(updated) });
  })
  .get('/', requireAdmin, zValidator('query', paginationSchema), async (c) => {
    const { page, limit } = c.req.valid('query');
    const skip = (page - 1) * limit;

    // Uses built-in _id_ index for chronological sort
    const [docs, total] = await Promise.all([
      UserModel.find({}).select('-passwordHash').sort({ _id: -1 }).skip(skip).limit(limit).lean(),
      UserModel.countDocuments({}),
    ]);

    return c.json({
      items: docs.map(serializeUser),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  })
  .post('/', requireAdmin, zValidator('json', adminCreateUserSchema), async (c) => {
    const { name, email, password, role, interests } = c.req.valid('json');

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
      role,
      interests: Array.from(new Set(interests.map((i) => i.toLowerCase().trim()).filter(Boolean))),
    });

    return c.json({ user: serializeUser(created) }, 201);
  })
  .patch('/:id', requireAdmin, zValidator('json', adminUpdateUserSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const updateFields: Record<string, unknown> = {};
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.email !== undefined) updateFields.email = body.email;
    if (body.role !== undefined) updateFields.role = body.role;
    if (body.interests !== undefined) {
      updateFields.interests = Array.from(
        new Set(body.interests.map((i) => i.toLowerCase().trim()).filter(Boolean))
      );
    }
    if (body.password) {
      updateFields.passwordHash = await Bun.password.hash(body.password, {
        algorithm: 'bcrypt',
        cost: 10,
      });
    }

    // Uses built-in _id_ index
    const updated = await UserModel.findByIdAndUpdate(id, updateFields, { new: true })
      .select('-passwordHash')
      .lean();

    if (!updated) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: serializeUser(updated) });
  })
  .delete('/:id', requireAdmin, zValidator('query', deleteUserQuerySchema), async (c) => {
    const id = c.req.param('id');
    const { keepData } = c.req.valid('query');

    // Uses built-in _id_ index
    const deletedUser = await UserModel.findByIdAndDelete(id).lean();
    if (!deletedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    let deletedNotesCount = 0;
    let deletedPostsCount = 0;

    if (!keepData) {
      // Uses left-prefix { userId: 1 } of Index 3 (notes) and Index 4 (posts)
      const [notesRes, postsRes] = await Promise.all([
        NoteModel.deleteMany({ userId: id }),
        PostModel.deleteMany({ userId: id }),
      ]);
      deletedNotesCount = notesRes.deletedCount || 0;
      deletedPostsCount = postsRes.deletedCount || 0;
    }

    return c.json({
      deletedUserId: id,
      keepData,
      deletedNotesCount,
      deletedPostsCount,
    });
  });
