import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PostModel } from '../models/Post';
import { requireAuth, type AppVariables } from '../middleware/auth';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const createPostSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
});

export function serializePost(doc: any): PostDTO {
  const isPopulated = doc.userId && typeof doc.userId === 'object' && '_id' in doc.userId;
  return {
    _id: String(doc._id),
    userId: isPopulated ? String(doc.userId._id) : String(doc.userId),
    author: isPopulated
      ? {
          _id: String(doc.userId._id),
          name: doc.userId.name,
          email: doc.userId.email,
          role: doc.userId.role,
        }
      : null,
    title: doc.title,
    body: doc.body,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

export const postRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', requireAuth)
  .get('/', zValidator('query', paginationSchema), async (c) => {
    const { page, limit } = c.req.valid('query');
    const skip = (page - 1) * limit;

    // Uses built-in _id_ index for global chronological sort
    const [docs, total] = await Promise.all([
      PostModel.find({})
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role')
        .lean(),
      PostModel.countDocuments({}),
    ]);

    return c.json({
      items: docs.map(serializePost),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  })
  .post('/', zValidator('json', createPostSchema), async (c) => {
    const authUser = c.get('user');
    const { title, body } = c.req.valid('json');

    const created = await PostModel.create({
      userId: authUser.id,
      title,
      body,
    });

    const populated = await created.populate('userId', 'name email role');
    return c.json({ post: serializePost(populated) }, 201);
  });
