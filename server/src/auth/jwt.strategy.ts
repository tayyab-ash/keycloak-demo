import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { normalizeEmail } from '../common/email';
import { AuthenticatedUser, KeycloakJwtPayload } from './types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const keycloakUrl = configService.getOrThrow<string>('KEYCLOAK_URL');
    const realm = configService.getOrThrow<string>('KEYCLOAK_REALM');
    const issuer = configService.getOrThrow<string>('KEYCLOAK_ISSUER');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
    });
  }

  validate(payload: KeycloakJwtPayload): AuthenticatedUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const email = payload.email ? normalizeEmail(payload.email) : '';
    const joinedName = [payload.given_name, payload.family_name]
      .filter(Boolean)
      .join(' ');
    const name =
      payload.name ||
      joinedName ||
      payload.preferred_username ||
      email ||
      payload.sub;

    return {
      id: payload.sub,
      username: payload.preferred_username || email || payload.sub,
      email,
      // Deny only when the IDP explicitly says the email is unverified.
      emailVerified: payload.email_verified !== false,
      name,
      roles: [],
      issuer: payload.iss ?? '',
      audience: payload.aud,
      expiresAt: payload.exp,
      issuedAt: payload.iat,
      raw: payload,
    };
  }
}
