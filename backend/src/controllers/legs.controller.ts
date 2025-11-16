import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { LegsService } from '../services/legs.service';
import { sendSuccess } from '../utils/responses';

export class LegsController {
  constructor(private legsService: LegsService) {}

  updateLeg = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;
    const updateData = req.body;

    const leg = await this.legsService.updateLeg(userId, id, updateData);
    return sendSuccess(res, leg);
  };

  updateLegState = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { id } = req.params;
    const { result_state } = req.body;

    const leg = await this.legsService.updateLegState(userId, id, result_state);
    return sendSuccess(res, leg);
  };
}

