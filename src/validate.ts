import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';
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
