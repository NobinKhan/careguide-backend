import { Hono } from 'hono';
import { z } from 'zod';
import { validate, paginationSchema } from '../validate';
import { PostModel } from '../models/Post';
import { buildAuthorMap, resolveAuthor } from './authors';
import { requireAuth, type AppVariables } from '../middleware/auth';

const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  body: z.string().min(1, 'Body is required').max(10000, 'Body must be 10000 characters or less'),
});

export function serializePost(doc: any, authorMap?: Map<string, AuthorSummaryDTO | null>): PostDTO {
  const { userId, author } = resolveAuthor(doc, authorMap);

  return {
    _id: String(doc._id),
    userId,
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
      PostModel.find({}).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
      PostModel.countDocuments({}),
    ]);

    const authorMap = await buildAuthorMap(docs.map((d) => d.userId));

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

    const authorMap = await buildAuthorMap([authUser.id]);

    return c.json({ post: serializePost(created, authorMap) }, 201);
  });
