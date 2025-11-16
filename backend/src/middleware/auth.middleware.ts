import { Request, Response, NextFunction } from 'express';
import { createUserClient } from '../services/supabase.service';
import { createError, errorCodes } from '../utils/errors';
import { sendError } from '../utils/responses';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  supabaseClient?: ReturnType<typeof createUserClient>;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, errorCodes.UNAUTHORIZED, 'Missing or invalid authorization header', 401);
      return;
    }

    const token = authHeader.substring(7);

    // Create user client with token
    const supabaseClient = createUserClient(token);

    // Verify token and get user
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      sendError(res, errorCodes.UNAUTHORIZED, 'Invalid or expired token', 401);
      return;
    }

    // Attach user and supabase client to request
    req.user = {
      id: user.id,
      email: user.email,
    };
    req.supabaseClient = supabaseClient;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    sendError(res, errorCodes.INTERNAL_SERVER_ERROR, 'Authentication failed', 500);
  }
};

