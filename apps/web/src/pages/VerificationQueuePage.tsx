import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TicketDTO } from '@campus/shared';
import { resolveApiUrl, webApi } from '../api/client';
import { PriorityBadge, StatusBadge, formatDateTime } from '../components/Badges';

export function VerificationQueuePage() {
  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reopenTargetId, setReopenTargetId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await webApi.listTickets({ status: 'Awaiting Verification', limit: 50 });
      setTickets(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verification queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClose(ticket: TicketDTO) {
    setBusyId(ticket.id);
    setError(null);
    setFeedback(null);
    try {
      await webApi.closeTicket(ticket.id, {
        verificationNote: 'Verified repair evidence in verification queue.',
        expectedVersion: ticket.version,
      });
      setFeedback(`Closed ${ticket.ticketNumber}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close ticket.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReopen(ticket: TicketDTO) {
    if (reopenReason.trim().length < 3) {
      setError('Please enter a reason before reopening the ticket.');
      return;
    }
    setBusyId(ticket.id);
    setError(null);
    setFeedback(null);
    try {
      await webApi.reopenTicket(ticket.id, {
        reason: reopenReason.trim(),
        expectedVersion: ticket.version,
      });
      setReopenTargetId(null);
      setReopenReason('');
      setFeedback(`Reopened ${ticket.ticketNumber}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen ticket.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Verification Queue</h2>
          <p className="page-subtitle">
            Inspect completed repairs side-by-side and close or reopen tickets
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      {loading ? (
        <div className="card">Loading tickets awaiting verification...</div>
      ) : tickets.length === 0 ? (
        <div className="card empty-state">
          All submitted repairs have been verified. No tickets are awaiting verification.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tickets.map((ticket) => {
            const beforePhoto = ticket.attachments.find((a) => a.kind === 'before_photo');
            const afterPhoto = ticket.attachments.find((a) => a.kind === 'after_photo');
            const isReopening = reopenTargetId === ticket.id;

            return (
              <div key={ticket.id} className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="mono"
                        style={{ color: 'var(--accent)', fontWeight: 700 }}
                      >
                        {ticket.ticketNumber}
                      </Link>
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {ticket.building.name} · Room {ticket.room.roomNumber}
                      </span>
                    </div>
                    <h3 style={{ margin: '6px 0 4px', fontSize: 17 }}>
                      <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                    </h3>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Technician: <strong>{ticket.assignee?.name ?? 'Unknown'}</strong> · Updated{' '}
                      {formatDateTime(ticket.updatedAt)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/tickets/${ticket.id}`} className="btn btn-secondary">
                      Full Details
                    </Link>
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={busyId === ticket.id}
                      onClick={() => handleClose(ticket)}
                    >
                      Verify &amp; Close
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busyId === ticket.id}
                      onClick={() => {
                        setReopenTargetId(isReopening ? null : ticket.id);
                        setReopenReason('');
                      }}
                    >
                      Reopen
                    </button>
                  </div>
                </div>

                {ticket.completionNote && (
                  <div className="alert alert-info" style={{ marginBottom: 14 }}>
                    <strong>Technician Completion Note:</strong> {ticket.completionNote}
                  </div>
                )}

                <div className="photo-compare-grid">
                  <div className="photo-frame">
                    {beforePhoto ? (
                      <img
                        src={resolveApiUrl(beforePhoto.url)}
                        alt="Before repair"
                        crossOrigin="use-credentials"
                      />
                    ) : (
                      <div className="empty-state">No before photo</div>
                    )}
                    <div className="photo-caption">Before Repair</div>
                  </div>

                  <div className="photo-frame">
                    {afterPhoto ? (
                      <img
                        src={resolveApiUrl(afterPhoto.url)}
                        alt="After repair"
                        crossOrigin="use-credentials"
                      />
                    ) : (
                      <div className="empty-state">No after-repair photo</div>
                    )}
                    <div className="photo-caption">After Repair</div>
                  </div>
                </div>

                {isReopening && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 240 }}
                      placeholder="Enter reason for reopening this ticket..."
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busyId === ticket.id}
                      onClick={() => handleReopen(ticket)}
                    >
                      Confirm Reopen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
