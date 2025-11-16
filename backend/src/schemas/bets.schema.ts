import { z } from 'zod';

export const createBetSchema = z.object({
  body: z.object({
    date: z.string().datetime(),
    stake: z.number().positive(),
    odds: z.number().positive().optional(),
    state: z.enum(['pending', 'won', 'lost', 'void']).optional().default('pending'),
    notes: z.string().optional(),
    legs: z.array(
      z.object({
        home_team_id: z.string().uuid().optional(),
        away_team_id: z.string().uuid().optional(),
        league_id: z.string().uuid().optional(),
        bet_type_id: z.string().uuid().optional(),
        category_id: z.string().uuid().optional(),
        responsible_id: z.string().uuid().optional(),
        odd: z.number().positive(),
        result_state: z.enum(['pending', 'won', 'lost', 'void']).optional().default('pending'),
        notes: z.string().optional(),
      })
    ).min(1),
  }),
});

export const updateBetSchema = z.object({
  body: z.object({
    stake: z.number().positive().optional(),
    odds: z.number().positive().optional(),
    state: z.enum(['pending', 'won', 'lost', 'void']).optional(),
    notes: z.string().optional(),
    profit_loss: z.number().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const updateBetStateSchema = z.object({
  body: z.object({
    state: z.enum(['won', 'lost', 'void']),
    profit_loss: z.number().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getBetsSchema = z.object({
  query: z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    state: z.enum(['pending', 'won', 'lost', 'void']).optional(),
    league_id: z.string().uuid().optional(),
    responsible_id: z.string().uuid().optional(),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
    offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional().default('0'),
  }),
});

export const getBetSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const deleteBetSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

