import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    interests: { type: [String], default: [] },
  },
  { timestamps: true }
);

// INDEX JUSTIFICATION (Index 1 of 4 - ESR Rule: Equality + Uniqueness):
// Supports fast O(log N) user lookup by email during POST /api/auth/login and enforces unique emails.
userSchema.index({ email: 1 }, { unique: true });

// INDEX JUSTIFICATION (Index 2 of 4 - ESR Rule: Multikey Index for Aggregation Scenario 1):
// Supports Scenario 1 Aggregation (Group Users by Interests) by indexing non-empty array elements in `interests`.
userSchema.index({ interests: 1 });

// NOTE ON ADMIN USER LISTING & USER LOOKUP:
// - Admin paginated user list (`GET /api/users`) sorts by `{ _id: -1 }`, utilizing MongoDB's built-in `_id_` index.
// - Scenario 2 (`$lookup` user posts) matches User by `{ _id }`, utilizing MongoDB's built-in `_id_` index.
// No additional indexes on User are needed.

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
