import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { NoteModel } from '../models/Note';
import { requireAuth, requireAdmin, type AppVariables } from '../middleware/auth';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

const updateNoteSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().min(1).optional(),
});

export function serializeNote(doc: any): NoteDTO {
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
    content: doc.content,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

export const noteRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', requireAuth)
  .get('/', zValidator('query', paginationSchema), async (c) => {
    const authUser = c.get('user');
    const { page, limit } = c.req.valid('query');
    const skip = (page - 1) * limit;

    // Uses Index 3: { userId: 1, _id: -1 } (ESR Rule: Equality on userId, Sort on _id: -1)
    const [docs, total] = await Promise.all([
      NoteModel.find({ userId: authUser.id })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NoteModel.countDocuments({ userId: authUser.id }),
    ]);

    return c.json({
      items: docs.map(serializeNote),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  })
  .get('/all', requireAdmin, zValidator('query', paginationSchema), async (c) => {
    const { page, limit } = c.req.valid('query');
    const skip = (page - 1) * limit;

    // Uses built-in _id_ index for global chronological sort
    const [docs, total] = await Promise.all([
      NoteModel.find({})
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role')
        .lean(),
      NoteModel.countDocuments({}),
    ]);

    return c.json({
      items: docs.map(serializeNote),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  })
  .post('/', zValidator('json', createNoteSchema), async (c) => {
    const authUser = c.get('user');
    const { title, content } = c.req.valid('json');

    const created = await NoteModel.create({
      userId: authUser.id,
      title,
      content,
    });

    return c.json({ note: serializeNote(created) }, 201);
  })
  .patch('/:id', zValidator('json', updateNoteSchema), async (c) => {
    const authUser = c.get('user');
    const id = c.req.param('id');
    const body = c.req.valid('json');

    // Enforces ownership check { _id, userId } for 'user' role (uses Index 3 left-prefix)
    const filter = authUser.role === 'admin' ? { _id: id } : { _id: id, userId: authUser.id };

    const updated = await NoteModel.findOneAndUpdate(filter, body, { new: true }).lean();
    if (!updated) {
      return c.json({ error: 'Note not found or access denied' }, 404);
    }

    return c.json({ note: serializeNote(updated) });
  })
  .delete('/:id', async (c) => {
    const authUser = c.get('user');
    const id = c.req.param('id');

    // Enforces ownership check { _id, userId } for 'user' role (uses Index 3 left-prefix)
    const filter = authUser.role === 'admin' ? { _id: id } : { _id: id, userId: authUser.id };

    const deleted = await NoteModel.findOneAndDelete(filter).lean();
    if (!deleted) {
      return c.json({ error: 'Note not found or access denied' }, 404);
    }

    return c.json({ deletedId: id });
  });
