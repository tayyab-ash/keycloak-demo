import axios from 'axios';
import { keycloak } from '@/lib/keycloak';

const baseURL = import.meta.env.VITE_PLATFORM_API_URL;

if (!baseURL) {
  throw new Error('Missing VITE_PLATFORM_API_URL');
}

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (keycloak.token) {
    config.headers.Authorization = `Bearer ${keycloak.token}`;
  }
  return config;
});

export type ApiKeyStatus = 'ACTIVE' | 'REVOKED';

export type ApiKey = {
  id: string;
  name: string;
  key: string;
  status: ApiKeyStatus;
  owner: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyStats = {
  total: number;
  active: number;
  revoked: number;
};

export type PortalRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type PortalUserStatus = 'ACTIVE' | 'DEACTIVATED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
export type InvitationType = 'BOOTSTRAP' | 'STANDARD';
export type SessionStatus = 'active' | 'pending_acceptance' | 'denied' | 'deactivated';

export type PortalUser = {
  id: string;
  email: string;
  name: string;
  role: PortalRole;
  status: PortalUserStatus;
  createdAt?: string;
  lastLoginAt?: string | null;
};

export type SessionInvitation = {
  id: string;
  email: string;
  role: PortalRole;
  type: InvitationType;
  invitedByName: string | null;
  expiresAt: string | null;
};

export type AuthSession = {
  status: SessionStatus;
  reason?: string;
  message: string;
  user?: PortalUser;
  invitation?: SessionInvitation;
};

export type Invitation = {
  id: string;
  email: string;
  role: PortalRole;
  type: InvitationType;
  status: InvitationStatus;
  expiresAt: string | null;
  createdAt: string;
  acceptedAt: string | null;
  invitedBy: { id: string; name: string; email: string } | null;
  acceptedUser: { id: string; name: string; email: string } | null;
};

export type Profile = {
  id: string;
  username: string;
  email: string;
  roles: string[];
  issuer: string | null;
  audience: string | string[] | null;
  expiresAt: number | null;
  issuedAt: number | null;
  tokenExpiration: string | null;
};

export async function fetchSession() {
  const { data } = await api.get<AuthSession>('/auth/session');
  return data;
}

export async function acceptInvitation() {
  const { data } = await api.post<AuthSession>('/auth/invitations/accept');
  return data;
}

export async function declineInvitation() {
  const { data } = await api.post<AuthSession>('/auth/invitations/decline');
  return data;
}

export async function fetchProfile() {
  const { data } = await api.get<Profile>('/profile');
  return data;
}

export async function fetchApiKeys() {
  const { data } = await api.get<ApiKey[]>('/api-keys');
  return data;
}

export async function fetchApiKeyStats() {
  const { data } = await api.get<ApiKeyStats>('/api-keys/stats');
  return data;
}

export async function createApiKey(name: string) {
  const { data } = await api.post<ApiKey>('/api-keys', { name });
  return data;
}

export async function revokeApiKey(id: string) {
  const { data } = await api.patch<ApiKey>(`/api-keys/${id}/revoke`);
  return data;
}

export async function deleteApiKey(id: string) {
  const { data } = await api.delete<{ deleted: boolean; id: string }>(`/api-keys/${id}`);
  return data;
}

export async function fetchPortalUsers() {
  const { data } = await api.get<PortalUser[]>('/admin/users');
  return data;
}

export async function updatePortalUser(
  userId: string,
  patch: { role?: PortalRole; status?: PortalUserStatus },
) {
  const { data } = await api.patch<PortalUser>(`/admin/users/${userId}`, patch);
  return data;
}

export async function fetchInvitations() {
  const { data } = await api.get<Invitation[]>('/admin/invitations');
  return data;
}

export async function createInvitation(email: string, role: Exclude<PortalRole, 'SUPER_ADMIN'>) {
  const { data } = await api.post<Invitation>('/admin/invitations', { email, role });
  return data;
}

export async function resendInvitation(id: string) {
  const { data } = await api.post<Invitation>(`/admin/invitations/${id}/resend`);
  return data;
}

export async function revokeInvitation(id: string) {
  const { data } = await api.post<Invitation>(`/admin/invitations/${id}/revoke`);
  return data;
}
