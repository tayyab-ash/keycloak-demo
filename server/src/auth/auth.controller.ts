import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser } from './types';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('session')
  getSession(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.resolveSession(user);
  }

  @Post('invitations/accept')
  accept(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.accept(user);
  }

  @Post('invitations/decline')
  decline(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.decline(user);
  }
}
