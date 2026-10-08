import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortalUserGuard } from '../auth/portal-user.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { UserRole } from '../../generated/prisma/client';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller('admin/invitations')
@UseGuards(JwtAuthGuard, PortalUserGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  list() {
    return this.invitationsService.list();
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(user, dto.email, dto.role);
  }

  @Post(':id/resend')
  resend(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invitationsService.resend(user, id);
  }

  @Post(':id/revoke')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invitationsService.revoke(user, id);
  }
}
