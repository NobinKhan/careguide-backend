import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../validate';
import { NoteModel } from '../models/Note';
import { UserModel } from '../models/User';
import { requireAuth, requireAdmin, type AppVariables } from '../middleware/auth';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or less'),
});

const updateNoteSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
});

export function serializeNote(
  doc: any,
  authorMap?: Map<string, AuthorSummaryDTO | null>
): NoteDTO {
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
    content: doc.content,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

export const noteRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', requireAuth)
  .get('/', validate('query', paginationSchema), async (c) => {
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
      items: docs.map((d) => serializeNote(d)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  })
  .get('/all', requireAdmin, validate('query', paginationSchema), async (c) => {
    const { page, limit } = c.req.valid('query');
    const skip = (page - 1) * limit;

    // Uses built-in _id_ index for global chronological sort
    const [docs, total] = await Promise.all([
      NoteModel.find({})
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NoteModel.countDocuments({}),
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
      items: docs.map((d) => serializeNote(d, authorMap)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  })
  .post('/', validate('json', createNoteSchema), async (c) => {
    const authUser = c.get('user');
    const { title, content } = c.req.valid('json');

    const created = await NoteModel.create({
      userId: authUser.id,
      title,
      content,
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

    return c.json({ note: serializeNote(created, authorMap) }, 201);
  })
  .patch('/:id', validate('json', updateNoteSchema), async (c) => {
    const authUser = c.get('user');
    const id = c.req.param('id');
    const body = c.req.valid('json');

    // Enforces ownership check { _id, userId } for 'user' role (uses Index 3 left-prefix)
    const filter = authUser.role === 'admin' ? { _id: id } : { _id: id, userId: authUser.id };

    const updated = await NoteModel.findOneAndUpdate(filter, body, { new: true }).lean();
    if (!updated) {
      return c.json({ error: 'Note not found or access denied' }, 404);
    }

    const noteOwner = await UserModel.findById(String(updated.userId)).select('name email role').lean();
    const authorMap = new Map<string, AuthorSummaryDTO>();
    if (noteOwner) {
      authorMap.set(String(updated.userId), {
        _id: String(noteOwner._id),
        name: noteOwner.name,
        email: noteOwner.email,
        role: noteOwner.role,
      });
    }

    return c.json({ note: serializeNote(updated, authorMap) });
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
