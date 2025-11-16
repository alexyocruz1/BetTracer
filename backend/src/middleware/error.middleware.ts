import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/responses';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return sendError(
      res,
      'VALIDATION_ERROR',
      'Validation failed',
      400,
      { errors: (err as any).errors }
    );
  }

  // Default error
  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred',
    500
  );
};

export const notFoundHandler = (req: Request, res: Response): Response => {
  return sendError(res, 'NOT_FOUND', 'Route not found', 404);
};

