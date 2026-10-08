import { Module } from '@nestjs/common';
import { KeycloakAdminService } from './keycloak-admin.service';
import { KeycloakIdpService } from './keycloak-idp.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, KeycloakAdminService, KeycloakIdpService],
})
export class UsersModule {}
