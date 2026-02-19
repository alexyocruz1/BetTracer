import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { CasinoEarningsService } from '../services/casino-earnings.service';
import { sendSuccess, sendError } from '../utils/responses';

export class CasinoEarningsController {
  constructor(private casinoEarningsService: CasinoEarningsService) {}

  create = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;

    const casinoEarning = await this.casinoEarningsService.create({
      user_id: userId,
      ...req.body,
    });

    return sendSuccess(res, casinoEarning, 201);
  };

  getById = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const casinoEarning = await this.casinoEarningsService.getById(id, userId);

    if (!casinoEarning) {
      return sendError(res, 'NOT_FOUND', 'Casino earning not found', 404);
    }

    return sendSuccess(res, casinoEarning);
  };

  getAll = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;

    const filters = {
      user_id: userId,
      start_date: req.query.start_date as string | undefined,
      end_date: req.query.end_date as string | undefined,
      type: req.query.type as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const { data, total } = await this.casinoEarningsService.getAll(filters);

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, data, 200, {
      pagination: {
        total,
        totalPages,
        page,
        limit,
      },
    });
  };

  update = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const casinoEarning = await this.casinoEarningsService.update(id, userId, req.body);

    return sendSuccess(res, casinoEarning);
  };

  delete = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;
    
    await this.casinoEarningsService.delete(id, userId);

    return res.status(204).send();
  };

  getTotalEarnings = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;

    const total = await this.casinoEarningsService.getTotalEarnings(userId, startDate, endDate);

    return sendSuccess(res, { total });
  };
}
