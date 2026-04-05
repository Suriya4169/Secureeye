// ===================================================================
// SecureEye Backend — OTP Service (Email-based OTP Authentication)
// ===================================================================

import crypto from 'crypto';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

// ----- In-Memory OTP Store -----
interface OtpEntry {
    otp: string;
    expiresAt: number;
    attempts: number;
}

const otpStore = new Map<string, OtpEntry>();
const MAX_ATTEMPTS = 5;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const JWT_SECRET = process.env.JWT_SECRET || 'secureeye-jwt-secret-change-me';

// ----- Email Transporter -----
let transporter: nodemailer.Transporter | null = null;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });
} else {
    logger.warn('Gmail credentials not set — OTP emails disabled');
}

// ----- Generate OTP -----
export function generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
}

// ----- Store OTP -----
export function storeOtp(email: string, otp: string): void {
    // Clear any existing OTP for this email
    if (otpStore.has(email)) {
        clearTimeout((otpStore.get(email) as any)._timeout);
    }

    const entry: OtpEntry = {
        otp,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
        attempts: 0,
    };

    otpStore.set(email, entry);

    // Auto-cleanup after expiry
    const timeout = setTimeout(() => {
        otpStore.delete(email);
        logger.info('OTP expired and cleaned up', { email });
    }, OTP_EXPIRY_MS);

    // Store timeout ref for cleanup
    (entry as any)._timeout = timeout;
}

// ----- Verify OTP -----
export function verifyOtp(email: string, otp: string): { valid: boolean; error?: string } {
    const entry = otpStore.get(email);

    if (!entry) {
        return { valid: false, error: 'No OTP found. Please request a new one.' };
    }

    if (Date.now() > entry.expiresAt) {
        otpStore.delete(email);
        return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }

    entry.attempts++;

    if (entry.attempts > MAX_ATTEMPTS) {
        otpStore.delete(email);
        return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
    }

    if (entry.otp !== otp) {
        return { valid: false, error: `Invalid OTP. ${MAX_ATTEMPTS - entry.attempts} attempts remaining.` };
    }

    // OTP is valid — clean up
    otpStore.delete(email);
    return { valid: true };
}

// ----- Generate JWT Token -----
export function generateToken(email: string): string {
    return jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
}

// ----- Verify JWT Token -----
export function verifyToken(token: string): { email: string } | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
        return decoded;
    } catch {
        return null;
    }
}

// ----- Send OTP Email -----
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
    if (!transporter) {
        logger.error('Email transporter not configured');
        throw new Error('Email service not configured');
    }

    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%); color: #fff; padding: 0; border-radius: 16px; overflow: hidden; border: 1px solid #222;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #ef4444;">
        <div style="font-size: 36px; margin-bottom: 8px;">🔐</div>
        <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">SecureEye</h1>
        <p style="color: #ef4444; margin: 4px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Security Verification</p>
      </div>
      
      <!-- Body -->
      <div style="padding: 32px 24px;">
        <p style="color: #ccc; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your one-time verification code is:
        </p>
        
        <!-- OTP Code -->
        <div style="background: linear-gradient(135deg, #1e1e3a 0%, #2a2a4a 100%); border: 2px solid #ef4444; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #ef4444; font-family: 'Courier New', monospace;">${otp}</span>
        </div>
        
        <!-- Info -->
        <div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
          <p style="color: #ff8a8a; font-size: 13px; margin: 0; line-height: 1.5;">
            ⏱ This code expires in <strong>5 minutes</strong><br/>
            🔒 Never share this code with anyone
          </p>
        </div>
        
        <p style="color: #666; font-size: 12px; line-height: 1.5; margin: 0;">
          If you didn't request this code, please ignore this email. Your account is safe.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background: #050510; padding: 16px 24px; text-align: center; border-top: 1px solid #222;">
        <p style="color: #444; font-size: 11px; margin: 0;">
          © ${new Date().getFullYear()} SecureEye • Powered by AI Security
        </p>
      </div>
    </div>
    `;

    await transporter.sendMail({
        from: `"SecureEye" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `🔐 SecureEye — Your Verification Code: ${otp}`,
        html,
    });

    logger.info('OTP email sent', { email });
}
