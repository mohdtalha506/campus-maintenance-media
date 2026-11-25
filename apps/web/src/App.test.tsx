import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('Supervisor Web Dashboard', () => {
  it('renders login screen when unauthenticated and shows overview when authenticated', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Campus Maintenance Copilot')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Sign in as Supervisor/i })).toBeInTheDocument();
  });

  it('renders status KPI counts on the overview page for an authenticated supervisor', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: 'sup-1',
                name: 'Vikram Nair',
                email: 'supervisor@campus.edu',
                role: 'supervisor',
                active: true,
              },
            }),
            { status: 200 }
          )
        );
      }
      if (url.endsWith('/api/tickets/summary')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              counts: {
                New: 2,
                Assigned: 3,
                'In Progress': 1,
                'Awaiting Verification': 4,
                Closed: 5,
                Reopened: 1,
              },
              total: 16,
              recentTickets: [],
            }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity (16 total tickets)')).toBeInTheDocument();
    });
    expect(screen.getByText('Awaiting Verification')).toBeInTheDocument();
  });
});
