import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  InvitationStatus,
  InvitationType,
  PrismaClient,
  UserRole,
  UserStatus,
} from '../generated/prisma/client';

const SUPER_ADMIN_EMAIL = 'admin@example.com';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const activeSuperAdmins = await prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    });
    if (activeSuperAdmins > 0) {
      console.log(
        'Active Super Admin already exists. Skipping bootstrap seed.',
      );
      return;
    }

    const existing = await prisma.invitation.findFirst({
      where: {
        email: SUPER_ADMIN_EMAIL,
        type: InvitationType.BOOTSTRAP,
        status: InvitationStatus.PENDING,
      },
    });
    if (existing) {
      console.log(
        `Bootstrap invitation for ${SUPER_ADMIN_EMAIL} already exists.`,
      );
      return;
    }

    await prisma.invitation.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        role: UserRole.SUPER_ADMIN,
        type: InvitationType.BOOTSTRAP,
        status: InvitationStatus.PENDING,
        expiresAt: null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        action: 'bootstrap_invite_seeded',
        email: SUPER_ADMIN_EMAIL,
        details: { role: UserRole.SUPER_ADMIN, source: 'prisma-seed' },
      },
    });

    console.log(
      `Seeded bootstrap Super Admin invitation for ${SUPER_ADMIN_EMAIL}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
