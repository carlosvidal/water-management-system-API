import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../index';
import { verifyAccessToken, getTokenFromHeader } from '../utils/jwt';
import { createError } from './errorHandler';
import { AuthenticatedUser, CondominiumAccess } from '../types/auth';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      condominiumAccess?: CondominiumAccess[];
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      throw createError('Access token required', 401);
    }

    // Handle demo token
    if (token === 'demo-token-123') {
      // Get demo user from database
      const demoUser = await prisma.user.findUnique({
        where: { email: 'demo@aquaflow.com' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      if (demoUser && demoUser.isActive) {
        // Get demo user's condominium access
        const condominiumAccess = await prisma.condominiumUser.findMany({
          where: { userId: demoUser.id },
          select: {
            condominiumId: true,
            role: true,
          },
        });

        req.user = demoUser;
        req.condominiumAccess = condominiumAccess;
        return next();
      }
    }

    // Handle real JWT tokens
    const payload = verifyAccessToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw createError('User not found', 401);
    }

    if (!user.isActive) {
      throw createError('User account is disabled', 401);
    }

    // Get user's condominium access
    const condominiumAccess = await prisma.condominiumUser.findMany({
      where: { userId: user.id },
      select: {
        condominiumId: true,
        role: true,
      },
    });

    req.user = user;
    req.condominiumAccess = condominiumAccess;
    
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (roles: UserRole | UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return next(createError('Insufficient permissions', 403));
    }

    next();
  };
};

export const requireCondominiumAccess = (
  requiredRole?: UserRole | UserRole[]
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const condominiumId = req.params.condominiumId || req.params.id;
    
    if (!condominiumId) {
      return next(createError('Condominium ID required', 400));
    }

    // Super admin has access to all condominiums
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Check if user has access to this condominium
    const access = req.condominiumAccess?.find(
      access => access.condominiumId === condominiumId
    );

    if (!access) {
      return next(createError('Access denied to this condominium', 403));
    }

    // Check specific role requirements if provided
    if (requiredRole) {
      const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      
      if (!allowedRoles.includes(access.role)) {
        return next(createError('Insufficient permissions for this condominium', 403));
      }
    }

    next();
  };
};

// Rate limiting for auth endpoints
const authAttempts: { [key: string]: { count: number; resetTime: number } } = {};

export const authRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5; // max attempts per window

  // Clean up expired entries
  if (authAttempts[key] && now > authAttempts[key].resetTime) {
    delete authAttempts[key];
  }

  // Initialize or increment counter
  if (!authAttempts[key]) {
    authAttempts[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
  } else {
    authAttempts[key].count++;
  }

  // Check if limit exceeded
  if (authAttempts[key].count > maxAttempts) {
    const timeLeft = Math.ceil((authAttempts[key].resetTime - now) / 1000);
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: `Too many login attempts. Try again in ${timeLeft} seconds.`,
      retryAfter: timeLeft,
    });
    return;
  }

  next();
};