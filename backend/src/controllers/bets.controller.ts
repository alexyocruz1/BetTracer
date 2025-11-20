import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { BetsService } from '../services/bets.service';
import { sendSuccess } from '../utils/responses';
import { invalidateUserMLCache } from './ml.controller';

export class BetsController {
  constructor(private betsService: BetsService) {}

  createBet = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      const betData = req.body;

      console.log('[BetsController] Creating bet for user:', userId);
      console.log('[BetsController] Request body:', JSON.stringify(betData, null, 2));

      const bet = await this.betsService.createBet(userId, betData);
      
      console.log('[BetsController] Bet created successfully, sending response');
      return sendSuccess(res, bet, 201);
    } catch (error: any) {
      console.error('[BetsController] Error creating bet:', error);
      throw error;
    }
  };

  getBets = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const {
      start_date,
      end_date,
      state,
      league_id,
      responsible_id,
      limit = 20,
      offset = 0,
    } = req.query;

    const { bets, total } = await this.betsService.getBets(userId, {
      start_date: start_date as string,
      end_date: end_date as string,
      state: state as string,
      league_id: league_id as string,
      responsible_id: responsible_id as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    const page = Math.floor(Number(offset) / Number(limit)) + 1;
    const totalPages = Math.ceil(total / Number(limit));

    return sendSuccess(res, bets, 200, {
      pagination: {
        page,
        limit: Number(limit),
        total,
        totalPages,
      },
    });
  };

  getBet = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;

    const bet = await this.betsService.getBetById(userId, id);
    return sendSuccess(res, bet);
  };

  updateBet = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;
    const updateData = req.body;

    const bet = await this.betsService.updateBet(userId, id, updateData);
    return sendSuccess(res, bet);
  };

  updateBetState = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;
    const stateData = req.body;

    const bet = await this.betsService.updateBetState(userId, id, stateData);
    
    // Invalidate ML cache when bet state changes (affects user analytics)
    // This ensures predictions reflect updated win rates, streaks, bankroll health, etc.
    if (stateData.state === 'won' || stateData.state === 'lost') {
      invalidateUserMLCache(userId);
    }
    
    return sendSuccess(res, bet);
  };

  deleteBet = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;

    await this.betsService.deleteBet(userId, id);
    return res.status(204).send();
  };
}

