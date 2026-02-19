import { z } from 'zod';

export const createCasinoEarningSchema = z.object({
  body: z.object({
    date: z.string().datetime(),
    amount: z.number(),
    source: z.string().min(1),
    type: z.enum(['casino_bet', 'daily_bonus', 'free_spins', 'cashback', 'promotion', 'other']),
    notes: z.string().optional(),
  }),
});

export const updateCasinoEarningSchema = z.object({
  body: z.object({
    date: z.string().datetime().optional(),
    amount: z.number().optional(),
    source: z.string().min(1).optional(),
    type: z.enum(['casino_bet', 'daily_bonus', 'free_spins', 'cashback', 'promotion', 'other']).optional(),
    notes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getCasinoEarningsSchema = z.object({
  query: z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    type: z.enum(['casino_bet', 'daily_bonus', 'free_spins', 'cashback', 'promotion', 'other']).optional(),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
    offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional().default('0'),
  }),
});

export const getCasinoEarningSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const deleteCasinoEarningSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
