import { zValidator } from '@hono/zod-validator';
import { z, type ZodType } from 'zod';
import type { ValidationTargets } from 'hono';

export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const i of result.error.issues) {
        fields[i.path.join('.') || '_'] ??= i.message;
      }
      return c.json(
        {
          error: result.error.issues[0]?.message ?? 'Invalid request',
          fields,
        },
        400
      );
    }
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(200, 'Name must be 200 characters or less');

export const emailSchema = z.string().trim().email('Valid email is required').toLowerCase();

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be 128 characters or less');

export const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(128, 'Password must be 128 characters or less');

export const interestsSchema = z.array(z.string().trim().min(1).max(40)).max(20);
