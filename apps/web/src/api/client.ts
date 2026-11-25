import type {
  BuildingDTO,
  DashboardSummaryDTO,
  LoginResponseDTO,
  NotificationListResponseDTO,
  PaginatedTicketsResponse,
  RoomDTO,
  TicketDetailDTO,
  TicketPriority,
  UserSummaryDTO,
} from '@campus/shared';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(resolveApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `Request failed with status ${res.status}`;
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } };
      if (data.error?.code) code = data.error.code;
      if (data.error?.message) message = data.error.message;
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export const webApi = {
  login: (email: string, password: string) =>
    request<LoginResponseDTO>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  me: () => request<{ user: UserSummaryDTO }>('/api/auth/me'),

  getSummary: () => request<DashboardSummaryDTO>('/api/tickets/summary'),

  listTickets: (params: Record<string, string | number | undefined>) => {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') {
        searchParams.set(k, String(v));
      }
    }
    return request<PaginatedTicketsResponse>(`/api/tickets?${searchParams.toString()}`);
  },

  getTicket: (id: string) => request<{ ticket: TicketDetailDTO }>(`/api/tickets/${id}`),

  assignTicket: (
    id: string,
    payload: { assigneeId: string; priority?: TicketPriority; expectedVersion: number }
  ) =>
    request<{ ticket: TicketDetailDTO }>(`/api/tickets/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updatePriority: (id: string, payload: { priority: TicketPriority; expectedVersion: number }) =>
    request<{ ticket: TicketDetailDTO }>(`/api/tickets/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  closeTicket: (id: string, payload: { verificationNote?: string; expectedVersion: number }) =>
    request<{ ticket: TicketDetailDTO }>(`/api/tickets/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reopenTicket: (id: string, payload: { reason: string; expectedVersion: number }) =>
    request<{ ticket: TicketDetailDTO }>(`/api/tickets/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listTechnicians: () => request<{ technicians: UserSummaryDTO[] }>('/api/users/technicians'),

  listLocations: (includeInactive = false) =>
    request<{ buildings: BuildingDTO[]; rooms: RoomDTO[] }>(
      `/api/locations${includeInactive ? '?includeInactive=true' : ''}`
    ),

  createBuilding: (payload: { name: string; code: string; description?: string }) =>
    request<{ building: BuildingDTO }>('/api/locations/buildings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateBuilding: (
    id: string,
    payload: Partial<{ name: string; code: string; description: string; active: boolean }>
  ) =>
    request<{ building: BuildingDTO }>(`/api/locations/buildings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createRoom: (payload: {
    buildingId: string;
    name: string;
    roomNumber: string;
    floor?: string;
  }) =>
    request<{ room: RoomDTO }>('/api/locations/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRoom: (
    id: string,
    payload: Partial<{ name: string; roomNumber: string; floor: string; active: boolean }>
  ) =>
    request<{ room: RoomDTO }>(`/api/locations/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listNotifications: () => request<NotificationListResponseDTO>('/api/notifications'),

  markNotificationRead: (id: string) =>
    request<{ unreadCount: number }>(`/api/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: () =>
    request<{ unreadCount: number }>('/api/notifications/read-all', { method: 'POST' }),
};
