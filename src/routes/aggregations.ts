import { Hono } from 'hono';
import { Types } from 'mongoose';
import { validate, paginationSchema } from '../validate';
import { UserModel } from '../models/User';
import { requireAuth, type AppVariables } from '../middleware/auth';

export const aggregationRoutes = new Hono<{ Variables: AppVariables }>()
  .use('*', requireAuth)
  .get('/users-by-interest', validate('query', paginationSchema), async (c) => {
    const { page, limit } = c.req.valid('query');

    // Scenario 1 Pipeline: Group Users by Interests with Pagination (Single UserModel.aggregate() call)
    const aggregated = await UserModel.aggregate([
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
      // Stage 5: Paginate within the same pipeline via $facet (zero extra queries)
      {
        $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          meta: [{ $count: 'total' }],
        },
      },
    ]);

    const result = aggregated[0] || { items: [], meta: [] };
    const total = result.meta?.[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const items: InterestGroupDTO[] = (result.items || []).map((group: any) => ({
      interest: String(group.interest),
      totalUsers: Number(group.totalUsers),
      users: (group.users || []).map((u: any) => ({
        _id: String(u._id),
        name: String(u.name),
        email: String(u.email),
        role: u.role === 'admin' ? 'admin' : 'user',
      })),
    }));

    return c.json({
      items,
      page,
      limit,
      total,
      totalPages,
    });
  })
  .get('/user-posts/:userId', validate('query', paginationSchema), async (c) => {
    const userId = c.req.param('userId');
    const { page, limit } = c.req.valid('query');

    if (!Types.ObjectId.isValid(userId)) {
      return c.json({ error: 'Invalid userId ObjectId' }, 400);
    }

    // Scenario 2 Pipeline: Retrieve All Posts Belonging to a Particular User (single $lookup stage)
    const userWithPosts = await UserModel.aggregate([
      // Stage 1: Match target user by _id (uses built-in _id_ index)
      { $match: { _id: new Types.ObjectId(userId) } },
      // Stage 2: Single $lookup stage from 'posts' collection (uses postSchema.index({ userId: 1, _id: -1 }))
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'userId',
          pipeline: [
            { $sort: { _id: -1 } },
            {
              $facet: {
                items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
                count: [{ $count: 'n' }],
              },
            },
          ],
          as: 'postsFacet',
        },
      },
      // Stage 3: Extract paged posts and total count from the single lookup facet
      {
        $addFields: {
          posts: { $ifNull: [{ $arrayElemAt: ['$postsFacet.items', 0] }, []] },
          postCount: { $ifNull: [{ $arrayElemAt: ['$postsFacet.count', 0] }, []] },
        },
      },
      // Stage 4: Exclude passwordHash and temporary facet field from output
      {
        $project: {
          passwordHash: 0,
          postsFacet: 0,
        },
      },
    ]);

    if (!userWithPosts.length) {
      return c.json({ error: 'User not found' }, 404);
    }

    const doc = userWithPosts[0];
    const total = doc.postCount?.[0]?.n ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

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
      total,
      totalPages,
    };

    return c.json(response);
  });
