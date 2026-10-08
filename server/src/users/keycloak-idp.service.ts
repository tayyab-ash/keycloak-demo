import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeycloakAdminService } from './keycloak-admin.service';

/**
 * Upserts a Google identity provider in Keycloak so invited Gmail users
 * can authenticate. Requires the service account to have
 * realm-management/manage-identity-providers.
 */
@Injectable()
export class KeycloakIdpService implements OnModuleInit {
  private readonly logger = new Logger(KeycloakIdpService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  async onModuleInit() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return;
    }

    try {
      await this.keycloakAdmin.upsertGoogleIdentityProvider(
        clientId,
        clientSecret,
      );
      this.logger.log('Google identity provider is configured in Keycloak');
    } catch (error) {
      this.logger.warn(
        'Could not configure Google identity provider. Add manage-identity-providers to the admin service account, or create the Google IDP in the Keycloak console.',
      );
      this.logger.debug(error);
    }
  }
}
