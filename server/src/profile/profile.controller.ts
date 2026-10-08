import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortalUserGuard } from '../auth/portal-user.guard';
import { AuthenticatedUser } from '../auth/types';

@Controller('profile')
@UseGuards(JwtAuthGuard, PortalUserGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      issuer: user.issuer,
      audience: user.audience,
      expiresAt: user.expiresAt,
      issuedAt: user.issuedAt,
      tokenExpiration: user.expiresAt
        ? new Date(user.expiresAt * 1000).toISOString()
        : null,
    };
  }
}
