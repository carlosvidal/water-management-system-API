import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('Twilio credentials not configured. SMS functionality will be disabled.');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export const twilioService = {
  /**
   * Send SMS message
   * @param to - Recipient phone number (format: +51999999999)
   * @param body - Message body
   */
  async sendSMS(to: string, body: string): Promise<void> {
    // Development mode: Just log the message instead of sending
    if (process.env.NODE_ENV === 'development') {
      console.log('====================================');
      console.log('📱 SMS (Development Mode - Not Sent)');
      console.log(`To: ${to}`);
      console.log(`Message: ${body}`);
      console.log('====================================');
      return;
    }

    if (!client || !twilioPhoneNumber) {
      console.error('Twilio not configured. Cannot send SMS.');
      throw new Error('SMS service not configured');
    }

    try {
      await client.messages.create({
        body,
        from: twilioPhoneNumber,
        to,
      });
      console.log(`SMS sent successfully to ${to}`);
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  },

  /**
   * Send OTP code via SMS
   * @param to - Recipient phone number
   * @param code - OTP code
   */
  async sendOTP(to: string, code: string): Promise<void> {
    const message = `Tu código de verificación es: ${code}. Válido por 10 minutos.`;
    await this.sendSMS(to, message);
  },

  /**
   * Validate phone number format
   * @param phone - Phone number to validate
   */
  isValidPhoneNumber(phone: string): boolean {
    // Format: +51 (Peru) followed by 9 digits
    const phoneRegex = /^\+\d{1,3}\d{6,14}$/;
    return phoneRegex.test(phone);
  },

  /**
   * Format phone number to E.164 format
   * @param phone - Phone number to format
   * @param countryCode - Country code (default: +51 for Peru)
   */
  formatPhoneNumber(phone: string, countryCode: string = '+51'): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it already starts with country code, return as is
    if (phone.startsWith('+')) {
      return phone;
    }

    // Add country code
    return `${countryCode}${digits}`;
  },
};
