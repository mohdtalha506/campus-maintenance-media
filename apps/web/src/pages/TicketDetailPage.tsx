import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  TICKET_PRIORITIES,
  type TicketDetailDTO,
  type TicketPriority,
  type UserSummaryDTO,
} from '@campus/shared';
import { resolveApiUrl, webApi } from '../api/client';
import { PriorityBadge, StatusBadge, formatDateTime } from '../components/Badges';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetailDTO | null>(null);
  const [technicians, setTechnicians] = useState<UserSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>('Medium');
  const [verificationNote, setVerificationNote] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [ticketRes, techRes] = await Promise.all([
        webApi.getTicket(id),
        webApi.listTechnicians(),
      ]);
      setTicket(ticketRes.ticket);
      setTechnicians(techRes.technicians);
      setSelectedAssigneeId(ticketRes.ticket.assignee?.id ?? '');
      setSelectedPriority(ticketRes.ticket.priority);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAssign() {
    if (!ticket || !selectedAssigneeId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await webApi.assignTicket(ticket.id, {
        assigneeId: selectedAssigneeId,
        priority: selectedPriority,
        expectedVersion: ticket.version,
      });
      setTicket(res.ticket);
      setNotice('Technician assignment updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign technician.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePriorityOnly() {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await webApi.updatePriority(ticket.id, {
        priority: selectedPriority,
        expectedVersion: ticket.version,
      });
      setTicket(res.ticket);
      setNotice('Priority updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await webApi.closeTicket(ticket.id, {
        verificationNote: verificationNote.trim() || undefined,
        expectedVersion: ticket.version,
      });
      setTicket(res.ticket);
      setVerificationNote('');
      setNotice('Ticket verified and closed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!ticket) return;
    if (reopenReason.trim().length < 3) {
      setError('Please enter a reason to reopen this ticket.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await webApi.reopenTicket(ticket.id, {
        reason: reopenReason.trim(),
        expectedVersion: ticket.version,
      });
      setTicket(res.ticket);
      setReopenReason('');
      setNotice('Ticket reopened.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen ticket.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !ticket) {
    return <div className="card">Loading ticket details...</div>;
  }

  if (!ticket) {
    return (
      <div className="card">
        <div className="alert alert-error">{error ?? 'Ticket not found.'}</div>
        <Link to="/queue" className="btn btn-secondary">
          Back to Work Queue
        </Link>
      </div>
    );
  }

  const beforePhoto = ticket.attachments.find((a) => a.kind === 'before_photo');
  const afterPhoto = ticket.attachments.find((a) => a.kind === 'after_photo');
  const voiceNote = ticket.attachments.find((a) => a.kind === 'voice_note');
  const canAssign =
    ticket.status === 'New' || ticket.status === 'Assigned' || ticket.status === 'Reopened';
  const canClose = ticket.status === 'Awaiting Verification';
  const canReopen = ticket.status === 'Awaiting Verification' || ticket.status === 'Closed';

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              {ticket.ticketNumber}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="badge" style={{ background: 'var(--bg-subtle)' }}>
              {ticket.category}
            </span>
          </div>
          <h2 className="page-title" style={{ marginTop: 8 }}>
            {ticket.title}
          </h2>
          <p className="page-subtitle">
            {ticket.building.name} ({ticket.building.code}) · {ticket.room.name} (Room{' '}
            {ticket.room.roomNumber}, {ticket.room.floor}) · Reported by {ticket.reporter.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/queue" className="btn btn-secondary">
            Back to Queue
          </Link>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <h3 className="card-title">Reported Issue</h3>
            <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>{ticket.description}</p>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Created {formatDateTime(ticket.createdAt)} · Last updated{' '}
              {formatDateTime(ticket.updatedAt)} · Version {ticket.version}
            </div>

            {ticket.completionNote && (
              <div className="alert alert-success" style={{ marginTop: 14, marginBottom: 0 }}>
                <strong>Technician Completion Note:</strong> {ticket.completionNote}
              </div>
            )}

            {ticket.reopenReason && (
              <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>
                <strong>Latest Reopen Reason:</strong> {ticket.reopenReason}
              </div>
            )}
          </div>

          {ticket.aiDraft && (
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <h3 className="card-title" style={{ margin: 0 }}>
                  AI Draft Reference
                </h3>
                <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {ticket.aiDraft.isMock ? `Mock AI (${ticket.aiDraft.model})` : ticket.aiDraft.model}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'grid', gap: 8 }}>
                <div>
                  <strong>Voice Transcript:</strong> {ticket.aiDraft.transcript}
                </div>
                <div>
                  <strong>Suggested Category:</strong> {ticket.aiDraft.suggestedCategory}
                </div>
                <div>
                  <strong>AI Title:</strong> {ticket.aiDraft.title}
                </div>
                <div>
                  <strong>AI Description:</strong> {ticket.aiDraft.description}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="card-title">Inspection Evidence &amp; Repair Comparison</h3>
            <div className="photo-compare-grid">
              <div className="photo-frame">
                {beforePhoto ? (
                  <img
                    src={resolveApiUrl(beforePhoto.url)}
                    alt="Before repair"
                    crossOrigin="use-credentials"
                  />
                ) : (
                  <div className="empty-state">No before photo attached</div>
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
                  <div className="empty-state">Awaiting technician repair photo</div>
                )}
                <div className="photo-caption">After Repair</div>
              </div>
            </div>

            {voiceNote && (
              <div style={{ marginTop: 14 }}>
                <div className="field-label">Original Voice Note ({voiceNote.originalName})</div>
                <audio
                  controls
                  crossOrigin="use-credentials"
                  src={resolveApiUrl(voiceNote.url)}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">Progress History</h3>
            <ul className="timeline">
              {ticket.events.map((ev) => (
                <li key={ev.id} className="timeline-item">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {ev.eventType.replace(/_/g, ' ').toUpperCase()}
                    {ev.fromStatus && ev.toStatus
                      ? ` (${ev.fromStatus} → ${ev.toStatus})`
                      : ev.toStatus
                        ? ` (${ev.toStatus})`
                        : ''}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    By {ev.actor.name} ({ev.actor.role}) · {formatDateTime(ev.createdAt)}
                  </div>
                  {Object.keys(ev.details).length > 0 && (
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {JSON.stringify(ev.details)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <h3 className="card-title">Priority &amp; Assignment</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="detail-priority" className="field-label">
                  Priority
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    id="detail-priority"
                    className="select"
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as TicketPriority)}
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy || selectedPriority === ticket.priority}
                    onClick={handlePriorityOnly}
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="detail-assignee" className="field-label">
                  Assigned Technician
                </label>
                <select
                  id="detail-assignee"
                  className="select"
                  value={selectedAssigneeId}
                  disabled={!canAssign}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                >
                  <option value="">Select technician...</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.email})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !canAssign || !selectedAssigneeId}
                onClick={handleAssign}
              >
                {ticket.assignee ? 'Reassign Technician' : 'Assign Technician'}
              </button>

              {!canAssign && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Assignment is available when status is New, Assigned, or Reopened.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Supervisor Verification</h3>
            {canClose && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <label htmlFor="verify-note" className="field-label">
                  Verification Note (optional)
                </label>
                <textarea
                  id="verify-note"
                  className="textarea"
                  rows={2}
                  placeholder="Confirmed leak stopped and room cleaned..."
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={busy}
                  onClick={handleClose}
                >
                  Verify &amp; Close Ticket
                </button>
              </div>
            )}

            {canReopen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label htmlFor="reopen-reason" className="field-label">
                  Reopen Reason
                </label>
                <textarea
                  id="reopen-reason"
                  className="textarea"
                  rows={2}
                  placeholder="Describe why repair needs follow-up..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={handleReopen}
                >
                  Reopen Ticket
                </button>
              </div>
            )}

            {!canClose && !canReopen && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Verification actions become available once a technician submits repair evidence
                (status: Awaiting Verification).
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
