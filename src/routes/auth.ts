import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { authRateLimit, authenticate } from '../middleware/auth';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '../types/auth';
import { otpService } from '../services/otpService';
import { twilioService } from '../services/twilioService';

const router = express.Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const phoneLoginSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
});

const verifyOTPSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  code: z.string().length(6, 'OTP code must be 6 digits'),
});

const resendOTPSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password to obtain access tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: admin@aquaflow.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: SuperAdmin123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 expiresIn:
 *                   type: string
 *                   description: Token expiration time
 *                   example: 1h
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Login endpoint
router.post('/login', authRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const validatedData = loginSchema.parse(req.body);
  const { email, password } = validatedData as LoginRequest;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      password: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw createError('Invalid credentials', 401);
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw createError('Invalid credentials', 401);
  }

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Log successful login
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  const response: LoginResponse = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  };

  res.json(response);
}));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Generate a new access token using a valid refresh token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: New JWT access token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 expiresIn:
 *                   type: string
 *                   description: Token expiration time
 *                   example: 1h
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Refresh token endpoint
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = refreshTokenSchema.parse(req.body);
  const { refreshToken } = validatedData as RefreshTokenRequest;

  try {
    const payload = verifyRefreshToken(refreshToken);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw createError('Invalid refresh token', 401);
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response: RefreshTokenResponse = {
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    };

    res.json(response);
  } catch (error) {
    throw createError('Invalid refresh token', 401);
  }
}));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: User logout
 *     description: Log out the authenticated user and invalidate the session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Logout endpoint
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // Log logout action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user!.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json({ message: 'Logged out successfully' });
}));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile information of the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: 123e4567-e89b-12d3-a456-426614174000
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: admin@aquaflow.com
 *                 name:
 *                   type: string
 *                   example: Super Administrator
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                   example: +1-555-0100
 *                 role:
 *                   type: string
 *                   enum: [SUPER_ADMIN, ADMIN, ANALYST, EDITOR, RESIDENT]
 *                   example: SUPER_ADMIN
 *                 isActive:
 *                   type: boolean
 *                   example: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-01T00:00:00.000Z
 *                 condominiumUsers:
 *                   type: array
 *                   description: Condominiums the user has access to
 *                   items:
 *                     type: object
 *                     properties:
 *                       condominiumId:
 *                         type: string
 *                         format: uuid
 *                       role:
 *                         type: string
 *                         enum: [SUPER_ADMIN, ADMIN, ANALYST, EDITOR, RESIDENT]
 *                       condominium:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           address:
 *                             type: string
 *                           isActive:
 *                             type: boolean
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get current user profile
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      condominiumUsers: {
        select: {
          condominiumId: true,
          role: true,
          condominium: {
            select: {
              id: true,
              name: true,
              address: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  res.json(user);
}));

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Send OTP to phone number
 *     description: Send a 6-digit OTP code via SMS for phone authentication (for ADMIN and EDITOR roles)
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number in E.164 format
 *                 example: +51999999999
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP sent successfully
 *                 expiresIn:
 *                   type: number
 *                   description: OTP expiration time in minutes
 *                   example: 10
 *       400:
 *         description: Invalid phone number or user not found
 *       429:
 *         description: Too many OTP requests
 */
router.post('/otp/send', authRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const validatedData = phoneLoginSchema.parse(req.body);
  const { phone } = validatedData;

  // Format phone number
  const formattedPhone = twilioService.formatPhoneNumber(phone);

  // Validate phone format
  if (!twilioService.isValidPhoneNumber(formattedPhone)) {
    throw createError('Invalid phone number format', 400);
  }

  // Find user by phone
  const user = await prisma.user.findUnique({
    where: { phone: formattedPhone },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw createError('User not found or inactive', 400);
  }

  // Check if user role allows mobile app access (ADMIN or EDITOR only)
  if (user.role !== 'ADMIN' && user.role !== 'EDITOR') {
    throw createError('Mobile app access is only available for Administrators and Editors', 403);
  }

  // Send OTP
  await otpService.sendOTP(user.id, formattedPhone);

  res.json({
    message: 'OTP sent successfully',
    expiresIn: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '10'),
  });
}));

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Verify OTP code
 *     description: Verify the OTP code sent to phone and authenticate the user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number in E.164 format
 *                 example: +51999999999
 *               code:
 *                 type: string
 *                 description: 6-digit OTP code
 *                 example: 123456
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *       400:
 *         description: Invalid OTP code
 *       401:
 *         description: OTP expired or too many attempts
 */
router.post('/otp/verify', authRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const validatedData = verifyOTPSchema.parse(req.body);
  const { phone, code } = validatedData;

  // Format phone number
  const formattedPhone = twilioService.formatPhoneNumber(phone);

  // Find user by phone
  const user = await prisma.user.findUnique({
    where: { phone: formattedPhone },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw createError('User not found or inactive', 400);
  }

  // Verify OTP
  const isValid = await otpService.verifyOTP(user.id, code);

  if (!isValid) {
    throw createError('Invalid OTP code', 400);
  }

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Log successful login
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN_OTP',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  const response: LoginResponse = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  };

  res.json(response);
}));

/**
 * @swagger
 * /auth/otp/resend:
 *   post:
 *     summary: Resend OTP code
 *     description: Request a new OTP code to be sent via SMS
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number in E.164 format
 *                 example: +51999999999
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Invalid phone number or too soon to resend
 *       429:
 *         description: Too many OTP requests
 */
router.post('/otp/resend', authRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const validatedData = resendOTPSchema.parse(req.body);
  const { phone } = validatedData;

  // Format phone number
  const formattedPhone = twilioService.formatPhoneNumber(phone);

  // Find user by phone
  const user = await prisma.user.findUnique({
    where: { phone: formattedPhone },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw createError('User not found', 400);
  }

  // Resend OTP
  await otpService.resendOTP(user.id);

  res.json({
    message: 'OTP resent successfully',
    expiresIn: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '10'),
  });
}));

export default router;