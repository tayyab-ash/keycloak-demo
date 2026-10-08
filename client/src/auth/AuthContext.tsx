import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { KeycloakTokenParsed } from 'keycloak-js';
import { fetchSession, type AuthSession, type PortalRole } from '@/lib/api';
import { getTokenClaims, initKeycloak, keycloak, loginWithDifferentAccount } from '@/lib/keycloak';

type AuthContextValue = {
  initialized: boolean;
  authenticated: boolean;
  sessionLoading: boolean;
  session: AuthSession | null;
  username: string;
  email: string;
  userId: string;
  roles: PortalRole[];
  claims: KeycloakTokenParsed | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  canManageKeys: boolean;
  login: () => void;
  loginWithDifferentAccount: () => void;
  logout: () => void;
  refreshSession: () => Promise<AuthSession | null>;
  tokenExpiresAt: Date | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [claims, setClaims] = useState<KeycloakTokenParsed | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const refreshSession = useCallback(async () => {
    if (!keycloak.authenticated || !keycloak.token) {
      setSession(null);
      return null;
    }

    setSessionLoading(true);
    try {
      const next = await fetchSession();
      setSession(next);
      return next;
    } catch (error) {
      console.error('Failed to resolve portal session', error);
      setSession({
        status: 'denied',
        reason: 'no_invitation',
        message: 'Unable to verify this account against the Admin Portal.',
      });
      return null;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const syncSession = (auth: boolean) => {
      setAuthenticated(auth);
      setClaims(auth ? (getTokenClaims() ?? null) : null);
      if (!auth) {
        setSession(null);
        setSessionLoading(false);
      }
    };

    keycloak.onAuthSuccess = () => {
      syncSession(true);
      void refreshSession();
    };
    keycloak.onAuthLogout = () => syncSession(false);
    keycloak.onAuthRefreshSuccess = () => {
      syncSession(true);
    };

    initKeycloak()
      .then(async (auth) => {
        if (!active) return;
        syncSession(auth);
        if (auth) {
          await refreshSession();
        }
        setInitialized(true);
      })
      .catch((error) => {
        console.error('Keycloak init failed', error);
        if (!active) return;
        setInitialized(true);
        syncSession(false);
      });

    return () => {
      active = false;
    };
  }, [refreshSession]);

  const portalRole = session?.user?.role;
  const roles: PortalRole[] = portalRole ? [portalRole] : [];

  const value: AuthContextValue = {
    initialized,
    authenticated,
    sessionLoading,
    session,
    username: session?.user?.name ?? claims?.preferred_username ?? claims?.email ?? 'unknown',
    email: session?.user?.email ?? claims?.email ?? '',
    userId: session?.user?.id ?? claims?.sub ?? '',
    roles,
    claims,
    isSuperAdmin: portalRole === 'SUPER_ADMIN',
    isAdmin: portalRole === 'ADMIN',
    canManageKeys: portalRole === 'ADMIN' || portalRole === 'SUPER_ADMIN',
    login: () => keycloak.login(),
    loginWithDifferentAccount,
    logout: () =>
      keycloak.logout({
        redirectUri: `${window.location.origin}/welcome`,
      }),
    refreshSession,
    tokenExpiresAt: claims?.exp ? new Date(claims.exp * 1000) : null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
