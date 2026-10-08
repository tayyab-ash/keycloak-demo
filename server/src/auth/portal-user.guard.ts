import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './types';

@Injectable()
export class PortalUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const identity = request.user;

    if (!identity?.id || !identity.issuer) {
      throw new ForbiddenException('Sign-in did not include a Keycloak subject.');
    }

    const portalUser = await this.prisma.user.findUnique({
      where: {
        keycloakSub_issuer: {
          keycloakSub: identity.id,
          issuer: identity.issuer,
        },
      },
    });

    if (!portalUser) {
      throw new ForbiddenException(
        "Your account isn't authorized for the Admin Portal. Ask your Super Admin to invite you.",
      );
    }

    if (portalUser.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'This account has been deactivated. Contact your Super Admin.',
      );
    }

    identity.roles = [portalUser.role];
    identity.portalUserId = portalUser.id;
    identity.portalStatus = portalUser.status;
    identity.email = portalUser.email;
    identity.name = portalUser.name;
    request.user = identity;
    return true;
  }
}
