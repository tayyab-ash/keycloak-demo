import Keycloak, { type KeycloakTokenParsed } from 'keycloak-js';

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
const realm = import.meta.env.VITE_KEYCLOAK_REALM;
const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;

if (!keycloakUrl || !realm || !clientId) {
  throw new Error(
    'Missing Keycloak env vars. Set VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID.',
  );
}

export const keycloak = new Keycloak({
  url: keycloakUrl,
  realm,
  clientId,
});

let initPromise: Promise<boolean> | null = null;

/** Safe under React StrictMode — keycloak-js allows init only once. */
export function initKeycloak() {
  if (!initPromise) {
    initPromise = keycloak
      .init({
        // Restore an existing SSO session on refresh without forcing login.
        // Unauthenticated users stay on the app (Welcome) instead of Keycloak.
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .catch((error) => {
        // Allow a full page reload to retry after config fixes.
        initPromise = null;
        throw error;
      });
  }
  return initPromise;
}

export function getTokenClaims(): KeycloakTokenParsed | undefined {
  return keycloak.tokenParsed;
}

export function loginWithHint(email?: string) {
  return keycloak.login({
    loginHint: email,
  });
}

export function loginWithDifferentAccount() {
  return keycloak.login({
    prompt: 'login',
  });
}
