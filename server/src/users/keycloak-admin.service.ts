import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type KeycloakRole = {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
};

export type KeycloakUserSummary = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  roles: string[];
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

type KeycloakUserRepresentation = {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
};

/** Built-in / composite roles Keycloak creates that we don't manage in the UI. */
function isSystemRealmRole(name: string): boolean {
  return (
    name.startsWith('default-roles-') ||
    name === 'offline_access' ||
    name === 'uma_authorization'
  );
}

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private tokenCache: TokenCache | null = null;

  constructor(private readonly configService: ConfigService) {}

  async listAvailableRoles(): Promise<KeycloakRole[]> {
    const roles = await this.adminFetch<KeycloakRole[]>('/roles');
    return roles
      .filter((role) => !isSystemRealmRole(role.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listUsers(): Promise<KeycloakUserSummary[]> {
    const [users, availableRoles] = await Promise.all([
      this.adminFetch<KeycloakUserRepresentation[]>(`/users?max=200`),
      this.listAvailableRoles(),
    ]);
    const manageable = new Set(availableRoles.map((role) => role.name));

    const summaries = await Promise.all(
      users
        .filter((user) => !user.username?.startsWith('service-account-'))
        .map(async (user) => {
          const roles = await this.getUserManageableRoles(user.id, manageable);
          return {
            id: user.id,
            username: user.username ?? '',
            email: user.email ?? '',
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            enabled: user.enabled ?? false,
            roles,
          };
        }),
    );

    return summaries.sort((a, b) => a.username.localeCompare(b.username));
  }

  async getUser(userId: string): Promise<KeycloakUserSummary> {
    const [user, availableRoles] = await Promise.all([
      this.adminFetch<KeycloakUserRepresentation>(
        `/users/${encodeURIComponent(userId)}`,
      ),
      this.listAvailableRoles(),
    ]);

    if (!user?.id) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const manageable = new Set(availableRoles.map((role) => role.name));
    const roles = await this.getUserManageableRoles(user.id, manageable);

    return {
      id: user.id,
      username: user.username ?? '',
      email: user.email ?? '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      enabled: user.enabled ?? false,
      roles,
    };
  }

  async updateUserRoles(
    userId: string,
    desiredRoles: string[],
  ): Promise<KeycloakUserSummary> {
    await this.getUser(userId);

    const availableRoles = await this.listAvailableRoles();
    const manageableNames = availableRoles.map((role) => role.name);
    const manageable = new Set(manageableNames);
    const roleByName = new Map(availableRoles.map((role) => [role.name, role]));

    const unknown = desiredRoles.filter((role) => !manageable.has(role));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown or non-manageable roles: ${unknown.join(', ')}`,
      );
    }

    const currentRoles = await this.getUserManageableRoles(userId, manageable);
    const desired = new Set(desiredRoles);
    const current = new Set(currentRoles);

    const toAdd = manageableNames.filter(
      (role) => desired.has(role) && !current.has(role),
    );
    const toRemove = manageableNames.filter(
      (role) => !desired.has(role) && current.has(role),
    );

    if (toAdd.length > 0) {
      const roleRepresentations = toAdd.map((name) => roleByName.get(name)!);
      await this.adminFetch(
        `/users/${encodeURIComponent(userId)}/role-mappings/realm`,
        {
          method: 'POST',
          body: JSON.stringify(roleRepresentations),
        },
      );
    }

    if (toRemove.length > 0) {
      const roleRepresentations = toRemove.map((name) => roleByName.get(name)!);
      await this.adminFetch(
        `/users/${encodeURIComponent(userId)}/role-mappings/realm`,
        {
          method: 'DELETE',
          body: JSON.stringify(roleRepresentations),
        },
      );
    }

    return this.getUser(userId);
  }

  private async getUserManageableRoles(
    userId: string,
    manageable: Set<string>,
  ): Promise<string[]> {
    const mappings = await this.adminFetch<KeycloakRole[]>(
      `/users/${encodeURIComponent(userId)}/role-mappings/realm`,
    );
    return mappings
      .map((mapping) => mapping.name)
      .filter((name) => manageable.has(name))
      .sort((a, b) => a.localeCompare(b));
  }

  async upsertGoogleIdentityProvider(
    clientId: string,
    clientSecret: string,
  ): Promise<void> {
    const body = {
      alias: 'google',
      displayName: 'Google',
      providerId: 'google',
      enabled: true,
      updateProfileFirstLoginMode: 'off',
      trustEmail: true,
      storeToken: false,
      addReadTokenRoleOnCreate: false,
      authenticateByDefault: false,
      linkOnly: false,
      firstBrokerLoginFlowAlias: 'first broker login',
      config: {
        clientId,
        clientSecret,
        defaultScope: 'openid email profile',
        syncMode: 'IMPORT',
        useJwksUrl: 'true',
      },
    };

    try {
      const existing = await this.adminFetch<Record<string, unknown>>(
        '/identity-provider/instances/google',
      );
      await this.adminFetch('/identity-provider/instances/google', {
        method: 'PUT',
        body: JSON.stringify({ ...existing, ...body, config: body.config }),
      });
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
      await this.adminFetch('/identity-provider/instances', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.accessToken;
    }

    const keycloakUrl = this.requireConfig('KEYCLOAK_URL');
    const realm = this.requireConfig('KEYCLOAK_REALM');
    const clientId = this.requireConfig('KEYCLOAK_ADMIN_CLIENT_ID');
    const clientSecret = this.requireConfig('KEYCLOAK_ADMIN_CLIENT_SECRET');

    const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (error) {
      this.logger.error('Failed to reach Keycloak token endpoint', error);
      throw new BadGatewayException('Unable to reach Keycloak token endpoint');
    }

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Token request failed (${response.status}): ${detail}`);
      throw new BadGatewayException('Unable to obtain Keycloak admin token');
    }

    const payload = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.tokenCache = {
      accessToken: payload.access_token,
      expiresAt: now + payload.expires_in * 1000,
    };

    return payload.access_token;
  }

  private async adminFetch<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const keycloakUrl = this.requireConfig('KEYCLOAK_URL');
    const realm = this.requireConfig('KEYCLOAK_REALM');
    const accessToken = await this.getAccessToken();
    const url = `${keycloakUrl}/admin/realms/${realm}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      this.logger.error(`Keycloak admin request failed: ${path}`, error);
      throw new BadGatewayException('Unable to reach Keycloak Admin API');
    }

    if (response.status === 404) {
      throw new NotFoundException(`Keycloak resource not found: ${path}`);
    }

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(
        `Keycloak admin request failed (${response.status}) ${path}: ${detail}`,
      );
      throw new BadGatewayException(
        `Keycloak Admin API error (${response.status})`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  private requireConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new BadGatewayException(`Missing required config: ${key}`);
    }
    return value.replace(/\/$/, '');
  }
}
