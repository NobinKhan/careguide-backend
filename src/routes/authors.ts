import { UserModel } from '../models/User';

export async function buildAuthorMap(
  rawIds: Iterable<unknown>
): Promise<Map<string, AuthorSummaryDTO>> {
  const userIds = Array.from(
    new Set(Array.from(rawIds, (id) => (id ? String(id) : '')).filter(Boolean))
  );
  const authorMap = new Map<string, AuthorSummaryDTO>();
  if (userIds.length === 0) {
    return authorMap;
  }

  // Uses built-in _id_ index
  const authors = await UserModel.find({ _id: { $in: userIds } })
    .select('name email role')
    .lean();

  for (const a of authors) {
    authorMap.set(String(a._id), {
      _id: String(a._id),
      name: a.name,
      email: a.email,
      role: a.role,
    });
  }

  return authorMap;
}

export function resolveAuthor(
  doc: any,
  authorMap?: Map<string, AuthorSummaryDTO | null>
): { userId: string; author: AuthorSummaryDTO | null } {
  const rawUserId = doc.userId?._id ? doc.userId._id : doc.userId;
  const userId = rawUserId ? String(rawUserId) : '';

  let author: AuthorSummaryDTO | null = null;
  if (authorMap) {
    author = authorMap.get(userId) ?? null;
  } else if (doc.userId && typeof doc.userId === 'object' && 'email' in doc.userId) {
    author = {
      _id: String(doc.userId._id),
      name: doc.userId.name,
      email: doc.userId.email,
      role: doc.userId.role,
    };
  }

  return { userId, author };
}
