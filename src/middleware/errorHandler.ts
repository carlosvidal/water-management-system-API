import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError | ZodError | PrismaClientKnownRequestError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: any = {};

  // Zod validation errors
  if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = {
      issues: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  // Prisma errors
  else if (error instanceof PrismaClientKnownRequestError) {
    statusCode = 400;
    switch (error.code) {
      case 'P2002':
        message = 'Unique constraint violation';
        details = { field: error.meta?.target };
        break;
      case 'P2025':
        message = 'Record not found';
        break;
      case 'P2003':
        message = 'Foreign key constraint violation';
        break;
      default:
        message = 'Database error';
        details = { code: error.code };
    }
  }
  // Custom app errors
  else if (error.isOperational) {
    statusCode = error.statusCode || 500;
    message = error.message;
  }
  // Unknown errors
  else {
    // Log unknown errors for debugging
    console.error('Unknown error:', error);
    if (process.env.NODE_ENV === 'development') {
      details = { stack: error.stack };
    }
  }

  // Send error response
  res.status(statusCode).json({
    error: true,
    message,
    statusCode,
    ...(Object.keys(details).length > 0 && { details }),
    ...(process.env.NODE_ENV === 'development' && { 
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    }),
  });
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};