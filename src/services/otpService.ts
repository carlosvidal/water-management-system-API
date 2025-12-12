import crypto from 'crypto';
import { prisma } from '../index';
import { twilioService } from './twilioService';

const OTP_EXPIRES_IN_MINUTES = parseInt(process.env.OTP_EXPIRES_IN_MINUTES || '10');
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3');

export const otpService = {
  /**
   * Generate a 6-digit OTP code
   */
  generateOTPCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  },

  /**
   * Send OTP to user's phone
   * @param userId - User ID
   * @param phone - User's phone number
   */
  async sendOTP(userId: string, phone: string): Promise<void> {
    // Generate OTP code
    const otpCode = this.generateOTPCode();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    // Save OTP to database
    await prisma.user.update({
      where: { id: userId },
      data: {
        otpCode,
        otpExpiry,
        otpAttempts: 0,
      },
    });

    // Send OTP via SMS
    await twilioService.sendOTP(phone, otpCode);

    console.log(`OTP sent to user ${userId} at ${phone}`);
  },

  /**
   * Send OTP to a phone number (for new user registration)
   * @param phone - Phone number
   */
  async sendOTPToPhone(phone: string): Promise<{ otpCode: string; otpExpiry: Date }> {
    // Validate phone format
    if (!twilioService.isValidPhoneNumber(phone)) {
      throw new Error('Invalid phone number format');
    }

    // Generate OTP code
    const otpCode = this.generateOTPCode();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    // Send OTP via SMS
    await twilioService.sendOTP(phone, otpCode);

    console.log(`OTP sent to phone ${phone}`);

    return { otpCode, otpExpiry };
  },

  /**
   * Verify OTP code
   * @param userId - User ID
   * @param code - OTP code to verify
   * @returns true if valid, false otherwise
   */
  async verifyOTP(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        otpCode: true,
        otpExpiry: true,
        otpAttempts: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if too many attempts
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new Error('Too many failed attempts. Please request a new code.');
    }

    // Check if OTP has expired
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      await this.clearOTP(userId);
      throw new Error('OTP code has expired');
    }

    // Check if OTP code matches
    if (user.otpCode !== code) {
      // Increment failed attempts
      await prisma.user.update({
        where: { id: userId },
        data: {
          otpAttempts: user.otpAttempts + 1,
        },
      });
      return false;
    }

    // OTP is valid - clear it and mark phone as verified
    await prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiry: null,
        otpAttempts: 0,
        phoneVerified: true,
      },
    });

    return true;
  },

  /**
   * Verify OTP for phone number (for new user registration)
   * @param phone - Phone number
   * @param code - OTP code
   * @param storedCode - Stored OTP code
   * @param storedExpiry - Stored OTP expiry
   */
  verifyOTPForPhone(
    code: string,
    storedCode: string,
    storedExpiry: Date
  ): boolean {
    // Check if OTP has expired
    if (storedExpiry < new Date()) {
      throw new Error('OTP code has expired');
    }

    // Check if OTP code matches
    return storedCode === code;
  },

  /**
   * Clear OTP data for a user
   * @param userId - User ID
   */
  async clearOTP(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiry: null,
        otpAttempts: 0,
      },
    });
  },

  /**
   * Resend OTP to user
   * @param userId - User ID
   */
  async resendOTP(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        otpExpiry: true,
      },
    });

    if (!user || !user.phone) {
      throw new Error('User not found or phone number not set');
    }

    // Check if last OTP is still valid (prevent spam)
    if (user.otpExpiry && user.otpExpiry > new Date()) {
      const remainingTime = Math.ceil(
        (user.otpExpiry.getTime() - Date.now()) / 1000 / 60
      );
      throw new Error(
        `Please wait ${remainingTime} minutes before requesting a new code`
      );
    }

    // Send new OTP
    await this.sendOTP(userId, user.phone);
  },
};
