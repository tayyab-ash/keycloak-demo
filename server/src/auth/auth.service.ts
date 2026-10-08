import { BadRequestException, Injectable } from '@nestjs/common';
import {
  InvitationStatus,
  InvitationType,
  Prisma,
  UserRole,
  UserStatus,
  type Invitation,
  type User,
} from '../../generated/prisma/client';
import { normalizeEmail } from '../common/email';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, DeniedReason, SessionStatus } from './types';

export type SessionInvitation = {
  id: string;
  email: string;
  role: UserRole;
  type: InvitationType;
  invitedByName: string | null;
  expiresAt: string | null;
};

export type SessionResponse = {
  status: SessionStatus;
  reason?: DeniedReason;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
  };
  invitation?: SessionInvitation;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveSession(identity: AuthenticatedUser): Promise<SessionResponse> {
    const existing = await this.findPortalUser(identity);

    if (existing) {
      return this.sessionForKnownUser(existing);
    }

    if (!identity.email) {
      await this.audit('login_denied', null, {
        reason: 'no_invitation',
        sub: identity.id,
      });
      return this.denied(
        'no_invitation',
        "Your account isn't authorized for the Admin Portal. Ask your Super Admin to invite you.",
      );
    }

    if (!identity.emailVerified) {
      await this.audit('login_denied', identity.email, {
        reason: 'email_unverified',
        sub: identity.id,
      });
      return this.denied(
        'email_unverified',
        'Your identity provider did not verify this email address. Contact your bank IT team.',
      );
    }

    const rebound = await this.rebindByEmail(identity);
    if (rebound) {
      return this.sessionForKnownUser(rebound);
    }

    const invitation = await this.findPendingInvite(identity.email);

    if (!invitation) {
      await this.audit('login_denied', identity.email, {
        reason: 'no_invitation',
        sub: identity.id,
      });
      return this.denied(
        'no_invitation',
        "Your account isn't authorized for the Admin Portal. Ask your Super Admin to invite you.",
      );
    }

    if (this.isExpired(invitation)) {
      if (invitation.status === InvitationStatus.PENDING) {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
      }
      await this.audit('login_denied', identity.email, {
        reason: 'invite_expired',
        invitationId: invitation.id,
      });
      return this.denied(
        'invite_expired',
        'Your invitation has expired. Ask your Super Admin to send a new one.',
      );
    }

    if (invitation.type === InvitationType.BOOTSTRAP) {
      const user = await this.acceptInvitation(identity, invitation);
      await this.audit('bootstrap_super_admin_created', identity.email, {
        userId: user.id,
        invitationId: invitation.id,
      });
      return {
        status: 'active',
        message: 'Super Admin account created',
        user: this.toPublicUser(user),
      };
    }

    return {
      status: 'pending_acceptance',
      message: 'You have a pending invitation.',
      invitation: await this.toSessionInvitation(invitation),
    };
  }

  async accept(identity: AuthenticatedUser): Promise<SessionResponse> {
    const session = await this.resolveSession(identity);
    if (session.status === 'active') {
      return session;
    }
    if (session.status !== 'pending_acceptance' || !session.invitation) {
      throw new BadRequestException(
        session.message || 'There is no invitation to accept.',
      );
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: session.invitation.id },
    });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'This invitation is no longer available. It may have been revoked or expired.',
      );
    }
    if (this.isExpired(invitation)) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException(
        'Your invitation has expired. Ask your Super Admin to send a new one.',
      );
    }
    if (normalizeEmail(invitation.email) !== identity.email) {
      throw new BadRequestException(
        'This invitation was sent to a different email address.',
      );
    }
    if (!identity.emailVerified) {
      throw new BadRequestException(
        'Your identity provider did not verify this email address.',
      );
    }

    const user = await this.acceptInvitation(identity, invitation);
    await this.audit('invite_accepted', identity.email, {
      userId: user.id,
      invitationId: invitation.id,
      role: invitation.role,
    });

    return {
      status: 'active',
      message: 'Invitation accepted',
      user: this.toPublicUser(user),
    };
  }

  async decline(identity: AuthenticatedUser): Promise<SessionResponse> {
    const session = await this.resolveSession(identity);
    if (session.status !== 'pending_acceptance' || !session.invitation) {
      throw new BadRequestException('There is no invitation to decline.');
    }

    const updated = await this.prisma.invitation.updateMany({
      where: {
        id: session.invitation.id,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.DECLINED },
    });

    if (updated.count === 0) {
      throw new BadRequestException('This invitation is no longer pending.');
    }

    await this.audit('invite_declined', identity.email, {
      invitationId: session.invitation.id,
    });

    return this.denied(
      'invite_declined',
      'You declined the invitation. The Super Admin can invite you again if needed.',
    );
  }

  private async acceptInvitation(
    identity: AuthenticatedUser,
    invitation: Invitation,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException('This invitation is no longer pending.');
      }

      const user = await tx.user.create({
        data: {
          keycloakSub: identity.id,
          issuer: identity.issuer,
          email: identity.email,
          name: identity.name,
          role: invitation.role,
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedUserId: user.id },
      });

      return user;
    });
  }

  private async sessionForKnownUser(user: User): Promise<SessionResponse> {
    if (user.status !== UserStatus.ACTIVE) {
      await this.audit('login_denied', user.email, {
        reason: 'account_deactivated',
        userId: user.id,
        keycloakSub: user.keycloakSub,
      });
      return {
        status: 'deactivated',
        reason: 'account_deactivated',
        message: 'This account has been deactivated. Contact your Super Admin.',
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      status: 'active',
      message: 'Signed in',
      user: this.toPublicUser(updated),
    };
  }

  private findPortalUser(identity: AuthenticatedUser) {
    if (!identity.id || !identity.issuer) {
      return null;
    }
    return this.prisma.user.findUnique({
      where: {
        keycloakSub_issuer: {
          keycloakSub: identity.id,
          issuer: identity.issuer,
        },
      },
    });
  }

  private async rebindByEmail(
    identity: AuthenticatedUser,
  ): Promise<User | null> {
    const users = await this.prisma.user.findMany({
      where: { email: identity.email },
      orderBy: { createdAt: 'asc' },
    });

    if (users.length !== 1) {
      return null;
    }

    const candidate = users[0];
    const updated = await this.prisma.user.update({
      where: { id: candidate.id },
      data: {
        keycloakSub: identity.id,
        issuer: identity.issuer,
      },
    });

    await this.audit('identity_rebound', identity.email, {
      userId: updated.id,
      keycloakSub: identity.id,
      issuer: identity.issuer,
      previousKeycloakSub: candidate.keycloakSub,
      previousIssuer: candidate.issuer,
    });

    return updated;
  }

  private findPendingInvite(email: string) {
    return this.prisma.invitation.findFirst({
      where: {
        email: normalizeEmail(email),
        status: InvitationStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isExpired(invitation: Invitation): boolean {
    return Boolean(
      invitation.expiresAt && invitation.expiresAt.getTime() < Date.now(),
    );
  }

  private async toSessionInvitation(
    invitation: Invitation,
  ): Promise<SessionInvitation> {
    const inviter = invitation.invitedById
      ? await this.prisma.user.findUnique({
          where: { id: invitation.invitedById },
        })
      : null;

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      type: invitation.type,
      invitedByName: inviter?.name ?? inviter?.email ?? null,
      expiresAt: invitation.expiresAt?.toISOString() ?? null,
    };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }

  private denied(reason: DeniedReason, message: string): SessionResponse {
    return { status: 'denied', reason, message };
  }

  private async audit(
    action: string,
    email: string | null,
    details?: Record<string, unknown>,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        action,
        email,
        details: details as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
