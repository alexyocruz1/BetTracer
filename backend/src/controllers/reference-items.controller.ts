import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ReferenceItemsService } from '../services/reference-items.service';
import { sendSuccess } from '../utils/responses';

export class ReferenceItemsController {
  constructor(private referenceItemsService: ReferenceItemsService) {}

  getReferenceItems = async (req: AuthRequest, res: Response): Promise<Response> => {
    const {
      kind,
      limit = 100,
      offset = 0,
    } = req.query;

    const { items, total } = await this.referenceItemsService.getReferenceItems({
      kind: kind as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    const page = Math.floor(Number(offset) / Number(limit)) + 1;
    const totalPages = Math.ceil(total / Number(limit));

    return sendSuccess(res, items, 200, {
      pagination: {
        page,
        limit: Number(limit),
        total,
        totalPages,
      },
    });
  };

  createReferenceItem = async (req: AuthRequest, res: Response): Promise<Response> => {
    const itemData = req.body;

    const item = await this.referenceItemsService.createReferenceItem(itemData);
    return sendSuccess(res, item, 201);
  };
}

