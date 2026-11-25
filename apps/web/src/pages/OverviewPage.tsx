import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardSummaryDTO } from '@campus/shared';
import { webApi } from '../api/client';
import { PriorityBadge, StatusBadge, formatDateTime } from '../components/Badges';

export function OverviewPage() {
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await webApi.getSummary();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Operations Overview</h2>
          <p className="page-subtitle">
            Live campus maintenance status across Academic Block, Labs, and Hostel
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/queue" className="btn btn-secondary">
            Open Work Queue
          </Link>
          <Link to="/verification" className="btn btn-primary">
            Verification Queue
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && !summary ? (
        <div className="card">Loading campus operations metrics...</div>
      ) : summary ? (
        <>
          <div className="kpi-grid">
            <Link to="/queue?status=New" className="kpi-card">
              <div className="kpi-label">New</div>
              <div className="kpi-value">{summary.counts.New}</div>
            </Link>
            <Link to="/queue?status=Assigned" className="kpi-card">
              <div className="kpi-label">Assigned</div>
              <div className="kpi-value">{summary.counts.Assigned}</div>
            </Link>
            <Link to="/queue?status=In%20Progress" className="kpi-card">
              <div className="kpi-label">In Progress</div>
              <div className="kpi-value">{summary.counts['In Progress']}</div>
            </Link>
            <Link to="/verification" className="kpi-card">
              <div className="kpi-label">Awaiting Verification</div>
              <div className="kpi-value">{summary.counts['Awaiting Verification']}</div>
            </Link>
            <Link to="/queue?status=Closed" className="kpi-card">
              <div className="kpi-label">Closed</div>
              <div className="kpi-value">{summary.counts.Closed}</div>
            </Link>
            <Link to="/queue?status=Reopened" className="kpi-card">
              <div className="kpi-label">Reopened</div>
              <div className="kpi-value">{summary.counts.Reopened}</div>
            </Link>
          </div>

          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <h3 className="card-title" style={{ margin: 0 }}>
                Recent Activity ({summary.total} total tickets)
              </h3>
              <button type="button" className="btn btn-secondary" onClick={load}>
                Refresh
              </button>
            </div>

            {summary.recentTickets.length === 0 ? (
              <div className="empty-state">No maintenance tickets have been submitted yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Issue</th>
                      <th>Location</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assignee</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentTickets.map((t) => (
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
                          {t.building.name} · {t.room.roomNumber}
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
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
