import * as SecureStore from 'expo-secure-store';
import type { UserSummaryDTO } from '@campus/shared';

const TOKEN_KEY = 'cmc_auth_token';
const USER_KEY = 'cmc_auth_user';
const API_URL_KEY = 'cmc_api_url';

export interface StoredSession {
  token: string;
  user: UserSummaryDTO;
}

export async function saveSecureSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
}

export async function loadSecureSession(): Promise<StoredSession | null> {
  const [token, rawUser] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  if (!token || !rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as UserSummaryDTO;
    return { token, user };
  } catch {
    return null;
  }
}

export async function clearSecureSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function saveApiBaseUrlOverride(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) {
    await SecureStore.deleteItemAsync(API_URL_KEY);
    return;
  }
  await SecureStore.setItemAsync(API_URL_KEY, trimmed);
}

export async function loadApiBaseUrlOverride(): Promise<string | null> {
  return SecureStore.getItemAsync(API_URL_KEY);
}
