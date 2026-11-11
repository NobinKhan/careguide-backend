import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../validate';
import { PostModel } from '../models/Post';
import { UserModel } from '../models/User';
import { requireAuth, type AppVariables } from '../middleware/auth';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const createPostSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  body: z.string().min(1, 'Body is required').max(10000, 'Body must be 10000 characters or less'),
});

export function serializePost(
  doc: any,
  authorMap?: Map<string, AuthorSummaryDTO | null>
): PostDTO {
  const rawUserId = doc.userId?._id ? doc.userId._id : doc.userId;
  const userIdStr = rawUserId ? String(rawUserId) : '';

  let author: AuthorSummaryDTO | null = null;
  if (authorMap) {
    author = authorMap.get(userIdStr) ?? null;
  } else if (doc.userId && typeof doc.userId === 'object' && 'email' in doc.userId) {
    author = {
      _id: String(doc.userId._id),
      name: doc.userId.name,
      email: doc.userId.email,
      role: doc.userId.role,
    };
  }

  return {
    _id: String(doc._id),
    userId: userIdStr,
    author,
    title: doc.title,
    body: doc.body,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

export const postRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', requireAuth)
  .get('/', validate('query', paginationSchema), async (c) => {
    const { page, limit } = c.req.valid('query');
    const skip = (page - 1) * limit;

    // Uses built-in _id_ index for global chronological sort
    const [docs, total] = await Promise.all([
      PostModel.find({})
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PostModel.countDocuments({}),
    ]);

    const userIds = Array.from(new Set(docs.map((d) => String(d.userId)).filter(Boolean)));
    const authors = await UserModel.find({ _id: { $in: userIds } })
      .select('name email role')
      .lean();

    const authorMap = new Map<string, AuthorSummaryDTO>();
    for (const a of authors) {
      authorMap.set(String(a._id), {
        _id: String(a._id),
        name: a.name,
        email: a.email,
        role: a.role,
      });
    }

    return c.json({
      items: docs.map((d) => serializePost(d, authorMap)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  })
  .post('/', validate('json', createPostSchema), async (c) => {
    const authUser = c.get('user');
    const { title, body } = c.req.valid('json');

    const created = await PostModel.create({
      userId: authUser.id,
      title,
      body,
    });

    const authorUser = await UserModel.findById(authUser.id).select('name email role').lean();
    const authorMap = new Map<string, AuthorSummaryDTO>();
    if (authorUser) {
      authorMap.set(authUser.id, {
        _id: String(authorUser._id),
        name: authorUser.name,
        email: authorUser.email,
        role: authorUser.role,
      });
    }

    return c.json({ post: serializePost(created, authorMap) }, 201);
  });
