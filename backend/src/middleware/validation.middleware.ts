import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/responses';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(
          res,
          'VALIDATION_ERROR',
          'Validation failed',
          400,
          { errors: error.errors }
        );
      } else {
        next(error);
      }
    }
  };
};

