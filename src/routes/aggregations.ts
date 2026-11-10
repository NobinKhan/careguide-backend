import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Types } from 'mongoose';
import { UserModel } from '../models/User';
import { requireAuth, type AppVariables } from '../middleware/auth';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const aggregationRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', requireAuth)
  .get('/users-by-interest', async (c) => {
    // Scenario 1 Pipeline: Group Users by Interests (Single UserModel.aggregate() call)
    const groupedByInterest = await UserModel.aggregate([
      // Stage 1: Filter users who have at least one interest (leverages { interests: 1 } multikey index)
      { $match: { interests: { $exists: true, $not: { $size: 0 } } } },
      // Stage 2: Deconstruct the interests array into individual documents
      { $unwind: '$interests' },
      // Stage 3: Group by interest string and collect matching user summaries
      {
        $group: {
          _id: '$interests',
          totalUsers: { $sum: 1 },
          users: {
            $push: {
              _id: '$_id',
              name: '$name',
              email: '$email',
              role: '$role',
            },
          },
        },
      },
      // Stage 4: Sort by most popular interest first, then alphabetically
      { $sort: { totalUsers: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          interest: '$_id',
          totalUsers: 1,
          users: 1,
        },
      },
    ]);

    const items: InterestGroupDTO[] = groupedByInterest.map((group) => ({
      interest: String(group.interest),
      totalUsers: Number(group.totalUsers),
      users: (group.users || []).map((u: any) => ({
        _id: String(u._id),
        name: String(u.name),
        email: String(u.email),
        role: u.role === 'admin' ? 'admin' : 'user',
      })),
    }));

    return c.json({ items });
  })
  .get('/user-posts/:userId', zValidator('query', paginationSchema), async (c) => {
    const userId = c.req.param('userId');
    const { page, limit } = c.req.valid('query');

    if (!Types.ObjectId.isValid(userId)) {
      return c.json({ error: 'Invalid userId ObjectId' }, 400);
    }

    // Scenario 2 Pipeline: Retrieve All Posts Belonging to a Particular User ($lookup)
    const userWithPosts = await UserModel.aggregate([
      // Stage 1: Match target user by _id (uses built-in _id_ index)
      { $match: { _id: new Types.ObjectId(userId) } },
      // Stage 2: $lookup posts from 'posts' collection (uses postSchema.index({ userId: 1, _id: -1 }))
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'userId',
          pipeline: [
            { $sort: { _id: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ],
          as: 'posts',
        },
      },
      // Stage 3: Exclude passwordHash from output
      {
        $project: {
          passwordHash: 0,
        },
      },
    ]);

    if (!userWithPosts.length) {
      return c.json({ error: 'User not found' }, 404);
    }

    const doc = userWithPosts[0];
    const response: UserPostsAggregationResponseDTO = {
      user: {
        _id: String(doc._id),
        name: doc.name,
        email: doc.email,
        role: doc.role,
        interests: Array.isArray(doc.interests) ? doc.interests : [],
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
        posts: (doc.posts || []).map((p: any) => ({
          _id: String(p._id),
          userId: String(p.userId),
          title: p.title,
          body: p.body,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
          updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined,
        })),
      },
      page,
      limit,
    };

    return c.json(response);
  });
