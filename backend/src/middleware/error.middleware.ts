import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/responses';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  console.error('Error handler called:', {
    message: err.message,
    code: err instanceof AppError ? err.code : 'UNKNOWN',
    statusCode: err instanceof AppError ? err.statusCode : 500,
    stack: err.stack,
  });

  if (err instanceof AppError) {
    try {
      sendError(res, err.code, err.message, err.statusCode, err.details);
    } catch (sendErr) {
      console.error('Failed to send error response:', sendErr);
      if (!res.headersSent) {
        res.status(err.statusCode || 500).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
    }
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    sendError(
      res,
      'VALIDATION_ERROR',
      'Validation failed',
      400,
      { errors: (err as any).errors }
    );
    return;
  }

  // Default error
  sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred',
    500
  );
};

export const notFoundHandler = (_req: Request, res: Response): Response => {
  return sendError(res, 'NOT_FOUND', 'Route not found', 404);
};

