import { z } from 'zod';

export const updateLegSchema = z.object({
  body: z.object({
    home_team_id: z.string().uuid().optional(),
    away_team_id: z.string().uuid().optional(),
    league_id: z.string().uuid().optional(),
    bet_type_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    responsible_id: z.string().uuid().optional(),
    odd: z.number().positive().optional(),
    result_state: z.enum(['pending', 'won', 'lost', 'void']).optional(),
    notes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const updateLegStateSchema = z.object({
  body: z.object({
    result_state: z.enum(['won', 'lost', 'void']),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

