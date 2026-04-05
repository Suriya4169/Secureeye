// ===================================================================
// SecureEye Backend — Email Service (Nodemailer Gmail SMTP)
// ===================================================================

import nodemailer from 'nodemailer';
import logger from '../utils/logger';

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
    logger.warn('Gmail credentials not set — email notifications disabled');
}

export interface AlertEmailData {
    toEmail: string;
    cameraLabel: string;
    confidence: number;
    snapshotUrl: string;
    timestamp: string;
    orgName: string;
}

export async function sendAlertEmail(data: AlertEmailData): Promise<void> {
    if (!transporter) {
        logger.warn('Email not configured, skipping alert email');
        return;
    }

    const { toEmail, cameraLabel, confidence, snapshotUrl, timestamp, orgName } = data;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 24px; border-radius: 12px;">
      <div style="text-align: center; padding: 16px 0; border-bottom: 1px solid #222;">
        <h1 style="color: #ef4444; margin: 0;">🚨 SecureEye Alert</h1>
        <p style="color: #888; margin: 4px 0;">${orgName}</p>
      </div>
      <div style="padding: 24px 0;">
        <h2 style="color: #ef4444;">⚠️ Detection Alert — ${cameraLabel}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #888;">Camera</td><td style="padding: 8px 0; color: #fff;">${cameraLabel}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Confidence</td><td style="padding: 8px 0; color: #ef4444; font-weight: bold;">${(confidence * 100).toFixed(1)}%</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Time</td><td style="padding: 8px 0; color: #fff;">${timestamp}</td></tr>
        </table>
        <div style="margin: 16px 0; text-align: center;">
          <img src="${snapshotUrl}" alt="Alert Snapshot" style="max-width: 100%; border-radius: 8px; border: 2px solid #ef4444;" />
        </div>
        <div style="text-align: center; padding: 16px 0;">
          <p style="color: #888; font-size: 12px;">Open SecureEye app to review this alert</p>
        </div>
      </div>
    </div>
  `;

    try {
        await transporter.sendMail({
            from: `"SecureEye" <${process.env.GMAIL_USER}>`,
            to: toEmail,
            subject: `🚨 SecureEye Alert: Detection on ${cameraLabel}`,
            html,
        });
        logger.info('Alert email sent', { to: toEmail, camera: cameraLabel });
    } catch (err) {
        logger.error('Failed to send alert email', { to: toEmail, error: err });
        throw err;
    }
}
