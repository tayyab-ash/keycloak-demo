import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ApiKeyStatus } from '../../generated/prisma/client';
import { AuthenticatedUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDemoKeys();
  }

  async findAll() {
    return this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const [total, active, revoked] = await Promise.all([
      this.prisma.apiKey.count(),
      this.prisma.apiKey.count({ where: { status: ApiKeyStatus.ACTIVE } }),
      this.prisma.apiKey.count({ where: { status: ApiKeyStatus.REVOKED } }),
    ]);

    return { total, active, revoked };
  }

  async create(dto: CreateApiKeyDto, user: AuthenticatedUser) {
    const key = `ak_live_${randomBytes(24).toString('hex')}`;

    return this.prisma.apiKey.create({
      data: {
        name: dto.name,
        key,
        status: ApiKeyStatus.ACTIVE,
        owner: user.username,
        ownerId: user.id,
      },
    });
  }

  async revoke(id: string) {
    await this.ensureExists(id);

    return this.prisma.apiKey.update({
      where: { id },
      data: { status: ApiKeyStatus.REVOKED },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.apiKey.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async ensureExists(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`API key ${id} not found`);
    }
    return existing;
  }

  private async seedDemoKeys() {
    const count = await this.prisma.apiKey.count();
    if (count > 0) {
      return;
    }

    await this.prisma.apiKey.createMany({
      data: [
        {
          name: 'Production Billing',
          key: `ak_live_${randomBytes(24).toString('hex')}`,
          status: ApiKeyStatus.ACTIVE,
          owner: 'admin',
          ownerId: 'seed-admin',
        },
        {
          name: 'Staging Webhooks',
          key: `ak_live_${randomBytes(24).toString('hex')}`,
          status: ApiKeyStatus.ACTIVE,
          owner: 'admin',
          ownerId: 'seed-admin',
        },
        {
          name: 'Legacy Partner Integration',
          key: `ak_live_${randomBytes(24).toString('hex')}`,
          status: ApiKeyStatus.REVOKED,
          owner: 'user',
          ownerId: 'seed-user',
        },
      ],
    });
  }
}
