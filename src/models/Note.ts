import { Schema, model, type InferSchemaType } from 'mongoose';

const noteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

// INDEX JUSTIFICATION (Index 3 of 4 - ESR Rule: Equality on `userId`, Sort on `_id: -1`):
// 1. Supports User viewing their own paginated notes (`find({ userId }).sort({ _id: -1 }).skip().limit()`) with zero in-memory sort.
// 2. Left-prefix `{ userId: 1 }` supports ownership verification on update/delete (`findOne({ _id, userId })`) and cascade deletion.
noteSchema.index({ userId: 1, _id: -1 });

// NOTE ON ADMIN VIEWING ALL NOTES:
// Admin paginated list of all notes (`GET /api/notes/all`) queries `find({}).sort({ _id: -1 }).skip().limit()`,
// which directly uses MongoDB's built-in `_id_` index. No extra index required.

export type Note = InferSchemaType<typeof noteSchema>;
export const NoteModel = model('Note', noteSchema);
