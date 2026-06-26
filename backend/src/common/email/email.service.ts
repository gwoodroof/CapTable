import { Injectable } from '@nestjs/common';
import * as postmark from 'postmark';

export interface LedgerNotificationParams {
  to: string;
  stakeholderName: string;
  companyName: string;
  tenantId: string;
  transactionType: string;
  quantity: string;
  securityLabel: string;
}

@Injectable()
export class EmailService {
  private client: postmark.ServerClient | null = null;
  private fromAddress: string;
  private appName: string;
  private frontendUrl: string;

  constructor() {
    const key = process.env.POSTMARK_API_KEY;
    if (key) this.client = new postmark.ServerClient(key);
    const domain = process.env.DOMAIN || 'getcaptable.com';
    this.fromAddress = `noreply@${domain}`;
    this.appName = process.env.APP_NAME || 'Cap Table';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  async sendLedgerNotification(params: LedgerNotificationParams): Promise<void> {
    if (!this.client) return;
    const { to, stakeholderName, companyName, tenantId, transactionType, quantity, securityLabel } = params;

    const TX_LABELS: Record<string, string> = {
      ISSUANCE: 'Issuance',
      VEST: 'Vesting',
      EXERCISE: 'Exercise',
      CANCELLATION: 'Cancellation',
      TRANSFER: 'Transfer',
      ADJUSTMENT: 'Adjustment',
    };
    const txLabel = TX_LABELS[transactionType] ?? transactionType.replace(/_/g, ' ');
    const equityUrl = `${this.frontendUrl}/company/${tenantId}/equity`;
    const formattedQty = Number(quantity).toLocaleString('en-US', { maximumFractionDigits: 4 });

    try {
    await this.client.sendEmail({
      From: this.fromAddress,
      To: to,
      Subject: `Equity update: ${txLabel} — ${companyName}`,
      HtmlBody: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
          <h2 style="margin-top:0">New equity transaction recorded</h2>
          <p>Hi ${stakeholderName},</p>
          <p>A new equity transaction has been recorded for your account with <strong>${companyName}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 0;color:#6b7280;width:40%">Transaction Type</td>
              <td style="padding:10px 0;font-weight:600">${txLabel}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:10px 0;color:#6b7280">Security</td>
              <td style="padding:10px 0;font-weight:600">${securityLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7280">Quantity</td>
              <td style="padding:10px 0;font-weight:600">${formattedQty} shares</td>
            </tr>
          </table>
          <p style="text-align:center;margin:32px 0">
            <a href="${equityUrl}"
               style="background:#0066cc;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
              View My Equity
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">If you have questions about this transaction, please contact your company's administrator.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">You are receiving this because you are a stakeholder in ${companyName} on ${this.appName}.</p>
        </div>
      `,
      TextBody: `New equity transaction recorded\n\nHi ${stakeholderName},\n\nA new equity transaction has been recorded for your account with ${companyName}.\n\nTransaction Type: ${txLabel}\nSecurity: ${securityLabel}\nQuantity: ${formattedQty} shares\n\nView your equity position at:\n${equityUrl}\n\nIf you have questions, please contact your company's administrator.`,
      MessageStream: 'outbound',
    });
    } catch (err) {
      console.error('[EmailService] Failed to send ledger notification:', err instanceof Error ? err.message : err);
    }
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    if (!this.client) return;
    const verifyUrl = `${this.frontendUrl}/auth/verify-email?token=${token}`;

    try {
    await this.client.sendEmail({
      From: this.fromAddress,
      To: email,
      Subject: `Verify your email address – ${this.appName}`,
      HtmlBody: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
          <h2 style="margin-top:0">Verify your email address</h2>
          <p>Thanks for signing up for ${this.appName}. Click the button below to verify your email address and complete your account setup.</p>
          <p style="text-align:center;margin:32px 0">
            <a href="${verifyUrl}"
               style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
              Verify Email Address
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">If the button above doesn't work, paste this URL into your browser:<br/>
            <a href="${verifyUrl}" style="color:#4f46e5;word-break:break-all">${verifyUrl}</a>
          </p>
        </div>
      `,
      TextBody: `Verify your email address\n\nThanks for signing up for ${this.appName}.\n\nClick the link below to verify your email address and complete your account setup:\n\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create an account, you can safely ignore this email.`,
      MessageStream: 'outbound',
    });
    } catch (err) {
      console.error('[EmailService] Failed to send verification email:', err instanceof Error ? err.message : err);
    }
  }
}
