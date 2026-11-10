import { Schema, model, type InferSchemaType } from 'mongoose';

const postSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
  },
  { timestamps: true }
);

// INDEX JUSTIFICATION (Index 4 of 4 - ESR Rule: Aggregation Scenario 2 `$lookup` & Chronological Sort):
// Directly accelerates Scenario 2 Aggregation (`$lookup` from `users._id` to `posts.userId` sorted by `_id: -1`) and cascade deletion.
postSchema.index({ userId: 1, _id: -1 });

export type Post = InferSchemaType<typeof postSchema>;
export const PostModel = model('Post', postSchema);
