import { Injectable } from '@nestjs/common';
import * as postmark from 'postmark';

@Injectable()
export class EmailService {
  private client: postmark.ServerClient;
  private fromAddress: string;
  private appName: string;
  private frontendUrl: string;

  constructor() {
    this.client = new postmark.ServerClient(process.env.POSTMARK_API_KEY!);
    const domain = process.env.DOMAIN || 'getcaptable.com';
    this.fromAddress = `noreply@${domain}`;
    this.appName = process.env.APP_NAME || 'Cap Table';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/auth/verify-email?token=${token}`;

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
  }
}
