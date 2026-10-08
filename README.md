# Keycloak OIDC + invitation-gated RBAC Demo

Production-like proof of concept for Admin Portal auth. Keycloak (OIDC Authorization Code + PKCE) proves **who** someone is. The Admin Portal database decides **whether they may enter** and **as which role**, through invitation-gated just-in-time provisioning.

## Invitation flow

1. `npx prisma db seed` creates a pending **bootstrap** invitation for `admin@example.com` if no active Super Admin exists.
2. That person signs in through Keycloak. The portal binds the new user to the Keycloak subject (`sub`) and issuer, matched to the bootstrap invitation by verified email, and skips the accept page.
3. The Super Admin invites other emails from **Users**. Invitees must be able to authenticate at Keycloak (or Google, if configured).
4. An invited user signs in, sees an Accept / Decline page, then becomes a portal user. Uninvited users are denied.

Returning users are found by Keycloak `sub` and issuer. If that key misses but the verified email matches exactly one existing user, the portal rebinds the subject and writes an `identity_rebound` audit event. That keeps access working after the Keycloak user is deleted and recreated.

Roles live in the portal DB, never in the access token. A valid Keycloak token alone is not enough for API access.

## Demo users (Keycloak)

| Username | Password   | Email               | Portal access                                         |
| -------- | ---------- | ------------------- | ----------------------------------------------------- |
| `admin`  | `admin123` | `admin@example.com` | Becomes Super Admin on first login (seeded invitation) |
| `user`   | `user123`  | `user@example.com`  | Denied until a Super Admin invites this email          |

## Permissions

| Action              | Super Admin | Admin | User |
| ------------------- | ----------- | ----- | ---- |
| View API keys       | yes         | yes   | yes  |
| Create / revoke / delete API keys | yes | yes | no (403) |
| Invite users        | yes         | no    | no   |
| Change roles / deactivate | yes   | no    | no   |

## Quick start (Docker)

```bash
cd keycloak-demo
docker compose up --build
```

Services:

| Service  | URL / port              | Notes                                      |
| -------- | ----------------------- | ------------------------------------------ |
| Frontend | http://localhost:3000   | Vite preview                               |
| Backend  | http://localhost:3008   | NestJS API                                 |
| Keycloak | http://localhost:8180   | Admin console: `demo` / `demo`             |
| Postgres | `localhost:5433`        | Host port mapped to avoid clashes on 5432  |

Open http://localhost:3000 — you land on the **welcome** screen; click **Continue to Sign In**. Sign in as `admin` / `admin123` to become the first Super Admin.

Postgres init (`docker/postgres/init.sql`) creates both:

- `keycloak_demo` — app database
- `keycloak` — Keycloak’s own database

## Local development

### 1. Start Postgres + Keycloak

```bash
docker compose up postgres keycloak
```

Wait until Keycloak finishes importing the realm (`keycloak/realm-export.json`).

### 2. Backend

```bash
cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run start:dev
```

API: http://localhost:3008  
Health: `GET /health`

When Postgres runs via Docker, use host port `5433` in `DATABASE_URL` (see below).

### 3. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

App: http://localhost:5173

## Environment variables

### Frontend (`client/.env`)

```env
VITE_PLATFORM_API_URL=http://localhost:3008
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=keycloak-demo
VITE_KEYCLOAK_CLIENT_ID=keycloak-demo-app
```

### Backend (`server/.env`)

```env
PORT=3008
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:admin@localhost:5433/keycloak_demo
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=keycloak-demo
KEYCLOAK_ISSUER=http://localhost:8180/realms/keycloak-demo
KEYCLOAK_ADMIN_CLIENT_ID=keycloak-admin-service
KEYCLOAK_ADMIN_CLIENT_SECRET=UMnoXBZMY6bJ4nJZTw3gZWSNfonUKiru
APP_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Invitation emails use SMTP (Gmail app password is fine for local testing). For invited Gmail users to sign in, add this Authorized redirect URI in Google Cloud Console, then set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` so the API can register a Google IDP in Keycloak:

```text
http://localhost:8180/realms/keycloak-demo/broker/google/endpoint
```

Notes:

- `KEYCLOAK_ISSUER` must match the `iss` claim in access tokens (browser-facing Keycloak URL).
- In Docker, the backend fetches JWKS from `http://keycloak:8080` while validating issuer `http://localhost:8180/realms/keycloak-demo`.
- `KEYCLOAK_CLIENT_ID` is only required on the frontend (public SPA client); the API validates tokens via JWKS + issuer, not client id.
- `KEYCLOAK_ADMIN_CLIENT_*` is a confidential service-account client used by the Nest API to call Keycloak Admin REST. Never put the client secret in `VITE_*` frontend env vars.

## Keycloak setup (manual)

The Docker import creates everything below automatically. Use these steps if you configure Keycloak by hand.

### Creating a Realm

1. Open http://localhost:8180 and sign in as Keycloak admin (`demo` / `demo`).
2. Create realm: **keycloak-demo**.

### Creating Roles

1. Realm roles → Create role `admin`.
2. Create role `user`.

### Creating Users

1. Users → Add user `admin` (email `admin@example.com`, email verified).
2. Credentials → password `admin123` (temporary: off).
3. Role mapping → assign `admin`.
4. Repeat for `user` / `user123` with role `user`.

### Creating the Client

1. Clients → Create client.
2. Client ID: `keycloak-demo-app`.
3. Client type: OpenID Connect.
4. Client authentication: **Off** (public client).
5. Standard flow: **On**.
6. Direct access grants: optional (useful for API testing).

### Configuring Redirect URIs

Valid redirect URIs:

```text
http://localhost:5173/*
http://localhost:3000/*
```

Web origins:

```text
http://localhost:5173
http://localhost:3000
```

Post-logout redirect URIs:

```text
http://localhost:5173/*
http://localhost:3000/*
```

PKCE: S256 (default for public clients in recent Keycloak).

Ensure realm roles are included in the access token (`realm_access.roles`). The built-in **roles** client scope does this by default.

### Creating the Admin Service Client

Used by the Nest API (client credentials) to list users and map realm roles.

1. Clients → Create client `keycloak-admin-service`.
2. Client authentication: **On** (confidential).
3. Authentication flow: disable Standard flow; enable **Service accounts roles**.
4. Credentials → copy the client secret into `KEYCLOAK_ADMIN_CLIENT_SECRET`.
5. Service account roles → assign from `realm-management`:
   - `view-users`, `query-users`, `manage-users`, `view-realm`

## API

| Method   | Path                        | Auth   | Roles             |
| -------- | --------------------------- | ------ | ----------------- |
| `GET`    | `/health`                   | public | —                 |
| `GET`    | `/profile`                  | JWT    | any authenticated |
| `GET`    | `/api-keys`                 | JWT    | admin, user       |
| `GET`    | `/api-keys/stats`           | JWT    | admin, user       |
| `POST`   | `/api-keys`                 | JWT    | admin             |
| `PATCH`  | `/api-keys/:id/revoke`      | JWT    | admin             |
| `DELETE` | `/api-keys/:id`             | JWT    | admin             |
| `GET`    | `/auth/session`             | JWT    | identity only; returns portal session |
| `POST`   | `/auth/invitations/accept`  | JWT    | pending invitee                       |
| `POST`   | `/auth/invitations/decline` | JWT    | pending invitee                       |
| `GET`    | `/admin/users`              | JWT    | super_admin                           |
| `PATCH`  | `/admin/users/:id`          | JWT    | super_admin                           |
| `GET`    | `/admin/invitations`        | JWT    | super_admin                           |
| `POST`   | `/admin/invitations`        | JWT    | super_admin                           |
| `POST`   | `/admin/invitations/:id/resend` | JWT | super_admin                        |
| `POST`   | `/admin/invitations/:id/revoke` | JWT | super_admin                        |

Backend authorization uses:

- `JwtAuthGuard` — validates Keycloak-issued JWTs via JWKS (identity only)
- `PortalUserGuard` — requires an active row in the portal `User` table
- `RolesGuard` + `@Roles(...)` — enforces RBAC from the portal DB role (never from token claims)

## Frontend routes

| Path         | Access                                        |
| ------------ | --------------------------------------------- |
| `/welcome`        | Public welcome screen; Sign in starts Keycloak |
| `/invite/accept`  | Authenticated invitee; Accept / Decline        |
| `/invite/denied`  | Authenticated but no invitation / deactivated  |
| `/`               | Redirects to `/dashboard`                      |
| `/dashboard`      | Active portal users                            |
| `/api-keys`       | Active portal users                            |
| `/session`        | Active portal users                            |
| `/users`          | Super Admin only; invite and manage users      |

Unauthenticated visits to protected routes redirect to `/welcome`.

## RBAC demo scenarios

### Scenario 1 — bootstrap Super Admin

1. From the welcome screen, continue to Sign in as `admin` / `admin123`.
2. The seeded invitation provisions you as Super Admin (no accept page).
3. Open **Users**, invite `user@example.com` as User or Admin.
4. Create, revoke, and delete API keys succeed.

### Scenario 2 — invited user

1. Logout, sign in as `user` / `user123` after being invited.
2. Accept the invitation.
3. API key write controls follow the assigned portal role.

### Scenario 3 — no invitation

1. Sign in as `user` / `user123` before anyone invites that email.
2. The portal shows the denied page. A valid Keycloak session is not enough.

Example (with a user access token):

```bash
curl -i -X POST http://localhost:3008/api-keys \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Fail"}'
```

## Project structure

```text
keycloak-demo/
├── client/                 # React SPA (Vite)
├── server/                 # NestJS API + Prisma
├── keycloak/               # Realm import (roles, users, client)
├── docker/postgres/        # Postgres init (creates keycloak DB)
└── docker-compose.yml
```

## Security notes

- Frontend roles only control UI visibility.
- Backend always validates JWTs against Keycloak JWKS and enforces roles server-side.
- No secrets are hardcoded in source; use `.env` files (see `.env.example`).
- Demo passwords are for local POC only.
