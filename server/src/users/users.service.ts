import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '../../generated/prisma/client';
import { AuthenticatedUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  }

  availableRoles() {
    return [
      { name: UserRole.SUPER_ADMIN, assignable: false },
      { name: UserRole.ADMIN, assignable: true },
      { name: UserRole.USER, assignable: true },
    ];
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    patch: { role?: UserRole; status?: UserStatus },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (actor.portalUserId === user.id) {
      if (patch.role && patch.role !== user.role) {
        throw new BadRequestException('You cannot change your own role.');
      }
      if (patch.status && patch.status !== user.status) {
        throw new BadRequestException('You cannot change your own status.');
      }
    }

    const demotingSuperAdmin =
      user.role === UserRole.SUPER_ADMIN &&
      ((patch.role !== undefined && patch.role !== UserRole.SUPER_ADMIN) ||
        patch.status === UserStatus.DEACTIVATED);

    if (demotingSuperAdmin) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      });
      if (activeSuperAdmins <= 1) {
        throw new BadRequestException(
          'There must be at least one active Super Admin.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(patch.role ? { role: patch.role } : {}),
        ...(patch.status ? { status: patch.status } : {}),
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'user_updated',
        email: updated.email,
        actorId: actor.portalUserId,
        details: {
          userId: updated.id,
          role: updated.role,
          status: updated.status,
        },
      },
    });

    return updated;
  }
}
