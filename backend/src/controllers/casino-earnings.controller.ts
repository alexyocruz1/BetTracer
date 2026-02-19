import { Request, Response } from 'express';
import { casinoEarningsService } from '../services/casino-earnings.service';

export const casinoEarningsController = {
  async create(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const casinoEarning = await casinoEarningsService.create({
        user_id: userId,
        ...req.body,
      });

      res.status(201).json({ data: casinoEarning });
    } catch (error: any) {
      console.error('Error creating casino earning:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const { id } = req.params;
      const casinoEarning = await casinoEarningsService.getById(id, userId);

      if (!casinoEarning) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Casino earning not found' } });
      }

      res.json({ data: casinoEarning });
    } catch (error: any) {
      console.error('Error fetching casino earning:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const filters = {
        user_id: userId,
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined,
        type: req.query.type as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const { data, total } = await casinoEarningsService.getAll(filters);

      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(total / limit);

      res.json({
        data,
        meta: {
          pagination: {
            total,
            totalPages,
            page,
            limit,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching casino earnings:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const { id } = req.params;
      const casinoEarning = await casinoEarningsService.update(id, userId, req.body);

      res.json({ data: casinoEarning });
    } catch (error: any) {
      console.error('Error updating casino earning:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const { id } = req.params;
      await casinoEarningsService.delete(id, userId);

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting casino earning:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  },

  async getTotalEarnings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const startDate = req.query.start_date as string | undefined;
      const endDate = req.query.end_date as string | undefined;

      const total = await casinoEarningsService.getTotalEarnings(userId, startDate, endDate);

      res.json({ data: { total } });
    } catch (error: any) {
      console.error('Error calculating total casino earnings:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  },
};
