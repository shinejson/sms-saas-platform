/**
 * Custom application error with structured information
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public internalMessage?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Tenant isolation violation error
 */
export class TenantIsolationError extends AppError {
  constructor(message: string = 'Record not found or access denied') {
    super(message, 404);
    this.name = 'TenantIsolationError';
  }
}

/**
 * Sanitize error messages to prevent information disclosure
 * 
 * @param error - The error to sanitize
 * @param isDevelopment - Whether running in development mode
 * @returns Sanitized error response object
 */
export function sanitizeError(error: unknown, isDevelopment: boolean = false): {
  error: string;
  statusCode: number;
  stack?: string;
} {
  // Log full error server-side for debugging
  console.error('[Error]', error);
  
  // Handle AppError instances - they have user-safe messages
  if (error instanceof AppError) {
    return {
      error: error.message,
      statusCode: error.statusCode,
      ...(isDevelopment && error.stack ? { stack: error.stack } : {}),
    };
  }
  
  // Handle standard Error instances
  if (error instanceof Error) {
    // In development, show more details
    if (isDevelopment) {
      return {
        error: error.message,
        statusCode: 500,
        stack: error.stack,
      };
    }
    
    // In production, use generic message to avoid leaking internals
    return {
      error: 'An internal error occurred. Please contact support if the problem persists.',
      statusCode: 500,
    };
  }
  
  // Handle unknown error types
  return {
    error: 'An unexpected error occurred. Please contact support.',
    statusCode: 500,
  };
}
