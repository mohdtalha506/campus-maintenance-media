import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MAINTENANCE_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type BuildingDTO,
  type PaginatedTicketsResponse,
  type UserSummaryDTO,
} from '@campus/shared';
import { webApi } from '../api/client';
import { PriorityBadge, StatusBadge, formatDateTime } from '../components/Badges';

export function WorkQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [priority, setPriority] = useState(searchParams.get('priority') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [buildingId, setBuildingId] = useState(searchParams.get('buildingId') ?? '');
  const [assigneeId, setAssigneeId] = useState(searchParams.get('assigneeId') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1) || 1);

  const [buildings, setBuildings] = useState<BuildingDTO[]>([]);
  const [technicians, setTechnicians] = useState<UserSummaryDTO[]>([]);
  const [data, setData] = useState<PaginatedTicketsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([webApi.listLocations(), webApi.listTechnicians()])
      .then(([locRes, techRes]) => {
        setBuildings(locRes.buildings);
        setTechnicians(techRes.technicians);
      })
      .catch(() => undefined);
  }, []);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await webApi.listTickets({
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        buildingId: buildingId || undefined,
        assigneeId: assigneeId || undefined,
        page,
        limit: 12,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work queue.');
    } finally {
      setLoading(false);
    }
  }, [search, status, priority, category, buildingId, assigneeId, page]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (search) nextParams.set('search', search);
    if (status) nextParams.set('status', status);
    if (priority) nextParams.set('priority', priority);
    if (category) nextParams.set('category', category);
    if (buildingId) nextParams.set('buildingId', buildingId);
    if (assigneeId) nextParams.set('assigneeId', assigneeId);
    if (page > 1) nextParams.set('page', String(page));
    setSearchParams(nextParams, { replace: true });
    void fetchQueue();
  }, [fetchQueue, search, status, priority, category, buildingId, assigneeId, page, setSearchParams]);

  function resetFilters() {
    setSearch('');
    setStatus('');
    setPriority('');
    setCategory('');
    setBuildingId('');
    setAssigneeId('');
    setPage(1);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Work Queue</h2>
          <p className="page-subtitle">Filter, triage, and assign campus maintenance tickets</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={resetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="filter-bar">
          <div>
            <label htmlFor="q-search" className="field-label">
              Search
            </label>
            <input
              id="q-search"
              className="input"
              placeholder="Ticket #, title, description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="q-status" className="field-label">
              Status
            </label>
            <select
              id="q-status"
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q-priority" className="field-label">
              Priority
            </label>
            <select
              id="q-priority"
              className="select"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All priorities</option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q-category" className="field-label">
              Category
            </label>
            <select
              id="q-category"
              className="select"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {MAINTENANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q-building" className="field-label">
              Building
            </label>
            <select
              id="q-building"
              className="select"
              value={buildingId}
              onChange={(e) => {
                setBuildingId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="q-tech" className="field-label">
              Assigned Technician
            </label>
            <select
              id="q-tech"
              className="select"
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All technicians</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {loading && !data ? (
          <div className="empty-state">Loading tickets...</div>
        ) : data && data.items.length === 0 ? (
          <div className="empty-state">No tickets match the selected filters.</div>
        ) : data ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Title</th>
                    <th>Location</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assignee</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">
                        <Link to={`/tickets/${t.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          {t.ticketNumber}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/tickets/${t.id}`} style={{ fontWeight: 500 }}>
                          {t.title}
                        </Link>
                      </td>
                      <td>
                        {t.building.name} · Room {t.room.roomNumber}
                      </td>
                      <td>{t.category}</td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td>{t.assignee ? t.assignee.name : 'Unassigned'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {formatDateTime(t.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 16,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Showing page {data.page} of {data.totalPages} ({data.total} tickets)
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
