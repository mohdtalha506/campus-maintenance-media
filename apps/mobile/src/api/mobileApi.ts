import Constants from 'expo-constants';
import type {
  AiDraftDTO,
  BuildingDTO,
  LoginResponseDTO,
  PaginatedTicketsResponse,
  RoomDTO,
  TicketDetailDTO,
  UserSummaryDTO,
} from '@campus/shared';

const defaultApiUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://10.0.2.2:4000';

let currentBaseUrl = defaultApiUrl.replace(/\/$/, '');
let currentToken: string | null = null;

export function setMobileApiBaseUrl(url: string | null): void {
  currentBaseUrl = (url && url.trim() ? url.trim() : defaultApiUrl).replace(/\/$/, '');
}

export function getMobileApiBaseUrl(): string {
  return currentBaseUrl;
}

export function setMobileAuthToken(token: string | null): void {
  currentToken = token;
}

export function getMobileAuthToken(): string | null {
  return currentToken;
}

export function resolveMobileMediaUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${currentBaseUrl}${path}`;
}

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers: Record<string, string> = {
    'X-Client-Type': 'mobile',
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    ...(!isFormData && init.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  const res = await fetch(`${currentBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as { error?: { code?: string; message?: string } };
      if (json.error?.code) code = json.error.code;
      if (json.error?.message) message = json.error.message;
    } catch {
      // ignore non-JSON body
    }
    throw new MobileApiError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export const mobileApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResponseDTO>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiRequest<{ user: UserSummaryDTO }>('/api/auth/me'),

  getLocations: () =>
    apiRequest<{ buildings: BuildingDTO[]; rooms: RoomDTO[] }>('/api/locations'),

  listTickets: (params: { status?: string; search?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return apiRequest<PaginatedTicketsResponse>(`/api/tickets?${query.toString()}`);
  },

  getTicket: (id: string) => apiRequest<{ ticket: TicketDetailDTO }>(`/api/tickets/${id}`),

  generateAiDraft: (params: {
    buildingId: string;
    roomId: string;
    audioUri: string;
    audioMimeType: string;
  }) => {
    const form = new FormData();
    form.append('buildingId', params.buildingId);
    form.append('roomId', params.roomId);
    form.append('audio', {
      uri: params.audioUri,
      name: params.audioUri.split('/').pop() ?? 'voice-note.m4a',
      type: params.audioMimeType,
    } as unknown as Blob);

    return apiRequest<{ draft: AiDraftDTO }>('/api/ai/draft', {
      method: 'POST',
      body: form,
    });
  },

  createTicket: (params: {
    clientSubmissionId: string;
    buildingId: string;
    roomId: string;
    title: string;
    description: string;
    category: string;
    aiDraft: AiDraftDTO | null;
    photoUri: string | null;
    photoMimeType: string | null;
    audioUri: string | null;
    audioMimeType: string | null;
  }) => {
    const form = new FormData();
    form.append('clientSubmissionId', params.clientSubmissionId);
    form.append('buildingId', params.buildingId);
    form.append('roomId', params.roomId);
    form.append('title', params.title);
    form.append('description', params.description);
    form.append('category', params.category);
    if (params.aiDraft) {
      form.append('aiDraft', JSON.stringify(params.aiDraft));
    }
    if (params.photoUri) {
      form.append('beforePhoto', {
        uri: params.photoUri,
        name: params.photoUri.split('/').pop() ?? 'before-photo.jpg',
        type: params.photoMimeType ?? 'image/jpeg',
      } as unknown as Blob);
    }
    if (params.audioUri) {
      form.append('voiceNote', {
        uri: params.audioUri,
        name: params.audioUri.split('/').pop() ?? 'voice-note.m4a',
        type: params.audioMimeType ?? 'audio/m4a',
      } as unknown as Blob);
    }

    return apiRequest<{ ticket: TicketDetailDTO; idempotentReplay: boolean }>('/api/tickets', {
      method: 'POST',
      body: form,
    });
  },

  startWork: (ticketId: string, expectedVersion: number) =>
    apiRequest<{ ticket: TicketDetailDTO }>(`/api/tickets/${ticketId}/start-work`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    }),

  submitRepair: (params: {
    ticketId: string;
    expectedVersion: number;
    completionNote: string;
    afterPhotoUri: string;
    afterPhotoMimeType: string;
  }) => {
    const form = new FormData();
    form.append('completionNote', params.completionNote);
    form.append('expectedVersion', String(params.expectedVersion));
    form.append('afterPhoto', {
      uri: params.afterPhotoUri,
      name: params.afterPhotoUri.split('/').pop() ?? 'after-repair.jpg',
      type: params.afterPhotoMimeType,
    } as unknown as Blob);

    return apiRequest<{ ticket: TicketDetailDTO }>(`/api/tickets/${params.ticketId}/submit-repair`, {
      method: 'POST',
      body: form,
    });
  },
};
