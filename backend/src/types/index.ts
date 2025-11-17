// Re-export shared types
export * from '../shared-types/index';

// Additional backend-specific types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationMeta {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

