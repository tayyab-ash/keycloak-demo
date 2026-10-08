import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, type gmail_v1 } from 'googleapis';
import type { UserRole } from '../../generated/prisma/client';
import { buildRawMimeMessage } from './mime';

const SEND_TIMEOUT_MS = 15_000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly gmail: gmail_v1.Gmail | null = null;
  private readonly from: string | null = null;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:5173';

    const config = {
      GOOGLE_CLIENT_ID: this.env('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: this.env('GOOGLE_CLIENT_SECRET'),
      GOOGLE_REFRESH_TOKEN: this.env('GOOGLE_REFRESH_TOKEN'),
      GMAIL_USER: this.env('GMAIL_USER'),
    };
    const missing = Object.entries(config)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missing.length > 0) {
      this.logger.warn(
        `Gmail API mail is not configured (missing ${missing.join(', ')}). Invitation emails will not be sent.`,
      );
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    this.from = this.env('MAIL_FROM') ?? config.GMAIL_USER!;

    const fromAddress = /<([^<>\s]+)>\s*$/.exec(this.from)?.[1] ?? this.from;
    if (fromAddress.toLowerCase() !== config.GMAIL_USER!.toLowerCase()) {
      this.logger.warn(
        `MAIL_FROM address (${fromAddress}) differs from GMAIL_USER (${config.GMAIL_USER}). Gmail will rewrite the From address unless it is a verified "Send mail as" alias on that account.`,
      );
    }
  }

  async sendInvite(params: {
    to: string;
    role: UserRole;
    inviterName: string;
  }): Promise<void> {
    const portalUrl = this.appUrl.replace(/\/$/, '');
    const roleLabel = this.roleLabel(params.role);
    const subject = `You've been invited to the Admin Portal as ${roleLabel}`;
    const text = [
      `${params.inviterName} invited you to join the Admin Portal as ${roleLabel}.`,
      '',
      `Sign in with your organization account at ${portalUrl}`,
      '',
      'If you were not expecting this, you can ignore this email or decline after signing in.',
    ].join('\n');

    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;margin:0 0 12px">Admin Portal</p>
        <h1 style="font-size:22px;margin:0 0 12px">You have been invited</h1>
        <p style="line-height:1.6;margin:0 0 16px">
          <strong>${this.escape(params.inviterName)}</strong> invited you to join
          the Admin Portal as <strong>${this.escape(roleLabel)}</strong>.
        </p>
        <p style="margin:24px 0">
          <a href="${portalUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">
            Accept invitation
          </a>
        </p>
        <p style="font-size:13px;color:#64748b;line-height:1.5">
          Sign in with the same email this invitation was sent to. The button only
          opens the portal — you accept or decline after signing in.
        </p>
      </div>
    `;

    await this.send(params.to, subject, text, html);
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    if (!this.gmail || !this.from) {
      throw new ServiceUnavailableException(
        'Mail is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN and GMAIL_USER.',
      );
    }

    const raw = buildRawMimeMessage({
      from: this.from,
      to,
      subject,
      text,
      html,
    });

    try {
      const { data } = await this.gmail.users.messages.send(
        { userId: 'me', requestBody: { raw } },
        { timeout: SEND_TIMEOUT_MS },
      );
      this.logger.log(`Sent mail to ${to} (Gmail message id ${data.id})`);
    } catch (error) {
      // Never log the raw error: it carries request config with the bearer
      // token and, for token refreshes, the client secret and refresh token.
      this.logger.error(
        `Failed to send mail to ${to} via Gmail API: ${this.describeGoogleError(error)}`,
      );
      throw new ServiceUnavailableException(
        'The invitation email could not be sent. Try again or check the Gmail API settings.',
      );
    }
  }

  private env(key: string): string | undefined {
    return this.configService.get<string>(key)?.trim() || undefined;
  }

  private describeGoogleError(error: unknown): string {
    if (typeof error !== 'object' || error === null) {
      return String(error);
    }

    const { response, code, message } = error as {
      response?: { status?: number; data?: unknown };
      code?: string | number;
      message?: unknown;
    };
    const data = response?.data as
      | {
          error?: string | { status?: string; message?: string };
          error_description?: string;
        }
      | undefined;

    const parts: string[] = [];
    if (response?.status) {
      parts.push(`status=${response.status}`);
    }
    if (typeof data?.error === 'string') {
      // OAuth token endpoint error, e.g. invalid_grant / invalid_client.
      parts.push(`error=${data.error}`);
      if (data.error_description) {
        parts.push(`description="${data.error_description}"`);
      }
      if (data.error === 'invalid_grant') {
        parts.push(
          'hint="GOOGLE_REFRESH_TOKEN is invalid, expired or revoked. Generate a new one."',
        );
      }
    } else if (data?.error) {
      // Gmail API error.
      if (data.error.status) parts.push(`reason=${data.error.status}`);
      if (data.error.message) parts.push(`message="${data.error.message}"`);
    } else {
      if (code) parts.push(`code=${code}`);
      if (typeof message === 'string') parts.push(`message="${message}"`);
    }

    return parts.length > 0 ? parts.join(' ') : 'unknown error';
  }

  private roleLabel(role: UserRole): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Admin';
      default:
        return 'User';
    }
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}
