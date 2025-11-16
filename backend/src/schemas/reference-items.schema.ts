import { z } from 'zod';

export const getReferenceItemsSchema = z.object({
  query: z.object({
    kind: z.enum(['team', 'league', 'bet_type', 'category', 'responsible']).optional(),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('100'),
    offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional().default('0'),
  }),
});

export const createReferenceItemSchema = z.object({
  body: z.object({
    kind: z.enum(['team', 'league', 'bet_type', 'category', 'responsible']),
    name: z.string().min(1),
    metadata: z.record(z.unknown()).optional().default({}),
  }),
});

