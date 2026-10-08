import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  InvitationType,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client';
import { AuthenticatedUser } from '../auth/types';
import { normalizeEmail } from '../common/email';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(identity: AuthenticatedUser, email: string, role: UserRole) {
    const normalized = normalizeEmail(email);
    if (!identity.portalUserId) {
      throw new BadRequestException('Portal user is required');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: normalized,
        status: UserStatus.ACTIVE,
      },
    });
    if (existingUser) {
      throw new BadRequestException(
        'An active user with this email already exists.',
      );
    }

    await this.mailService.sendInvite({
      to: normalized,
      role,
      inviterName: identity.name || identity.email,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.invitation.updateMany({
          where: {
            email: normalized,
            status: InvitationStatus.PENDING,
          },
          data: { status: InvitationStatus.REVOKED },
        });

        const invitation = await tx.invitation.create({
          data: {
            email: normalized,
            role,
            type: InvitationType.STANDARD,
            status: InvitationStatus.PENDING,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS),
            invitedById: identity.portalUserId,
          },
        });

        await tx.auditEvent.create({
          data: {
            action: 'invite_created',
            email: normalized,
            actorId: identity.portalUserId,
            details: { invitationId: invitation.id, role },
          },
        });

        return invitation;
      });
    } catch (error) {
      this.logger.error(
        `Invitation email was sent to ${normalized} but the invitation record could not be saved`,
        error,
      );
      throw error;
    }
  }

  async list() {
    await this.expireStale();
    return this.prisma.invitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
        acceptedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async resend(identity: AuthenticatedUser, id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.type === InvitationType.BOOTSTRAP) {
      throw new BadRequestException('The bootstrap invitation has no email.');
    }
    if (
      invitation.status !== InvitationStatus.PENDING &&
      invitation.status !== InvitationStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Only pending or expired invitations can be resent.',
      );
    }

    await this.mailService.sendInvite({
      to: invitation.email,
      role: invitation.role,
      inviterName: identity.name || identity.email,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.invitation.updateMany({
          where: {
            id,
            status: {
              in: [InvitationStatus.PENDING, InvitationStatus.EXPIRED],
            },
          },
          data: {
            status: InvitationStatus.PENDING,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'This invitation is no longer pending.',
          );
        }

        const updated = await tx.invitation.findUniqueOrThrow({
          where: { id },
        });

        await tx.auditEvent.create({
          data: {
            action: 'invite_resent',
            email: updated.email,
            actorId: identity.portalUserId,
            details: { invitationId: updated.id },
          },
        });

        return updated;
      });
    } catch (error) {
      this.logger.error(
        `Invitation email was resent to ${invitation.email} but the invitation record could not be updated`,
        error,
      );
      throw error;
    }
  }

  async revoke(identity: AuthenticatedUser, id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked.');
    }

    const updated = await this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'invite_revoked',
        email: updated.email,
        actorId: identity.portalUserId,
        details: { invitationId: updated.id },
      },
    });

    return updated;
  }

  private async expireStale() {
    await this.prisma.invitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: InvitationStatus.EXPIRED },
    });
  }
}
