import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
import nodemailer, { type Transporter } from 'nodemailer';
import type { UserRole } from '../../generated/prisma/client';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  } | null = null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    const host =
      this.configService.get<string>('SMTP_HOST') ?? 'smtp.gmail.com';
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 465);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.from =
      this.configService.get<string>('MAIL_FROM') ??
      user ??
      'noreply@localhost';
    this.appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:5173';

    if (!user || !pass) {
      this.logger.warn(
        'SMTP_USER / SMTP_PASS are not set. Invitation emails will not be sent.',
      );
      return;
    }

    this.smtp = { host, port, user, pass };
  }

  private async createTransporter(): Promise<Transporter> {
    const { host, port, user, pass } = this.smtp!;
    const [ipv4] = isIP(host) ? [host] : await resolve4(host);

    return nodemailer.createTransport({
      host: ipv4,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { servername: host },
    });
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
    if (!this.smtp) {
      throw new ServiceUnavailableException(
        'Mail is not configured. Set SMTP_USER and SMTP_PASS.',
      );
    }

    let transporter: Transporter | undefined;
    try {
      transporter = await this.createTransporter();
      await transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send mail to ${to}`, error);
      throw new ServiceUnavailableException(
        'The invitation email could not be sent. Try again or check SMTP settings.',
      );
    } finally {
      transporter?.close();
    }
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
