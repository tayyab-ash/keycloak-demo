import { UserRole, UserStatus } from '../../generated/prisma/client';

export type AppRole = UserRole;

export type SessionStatus =
  'active' | 'pending_acceptance' | 'denied' | 'deactivated';

export type DeniedReason =
  | 'no_invitation'
  | 'invite_expired'
  | 'invite_revoked'
  | 'invite_declined'
  | 'email_unverified'
  | 'account_deactivated';

export interface KeycloakJwtPayload {
  sub: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  azp?: string;
  typ?: string;
  jti?: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  name: string;
  roles: AppRole[];
  issuer: string;
  audience?: string | string[];
  expiresAt?: number;
  issuedAt?: number;
  portalUserId?: string;
  portalStatus?: UserStatus;
  raw: KeycloakJwtPayload;
}
