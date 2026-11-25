import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  TICKET_EVENT_TYPES,
  TICKET_STATUSES,
  type TicketEventType,
  type TicketStatus,
} from '@campus/shared';

export interface ITicketEvent extends Document {
  ticketId: Types.ObjectId;
  actorId: Types.ObjectId;
  eventType: TicketEventType;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  details: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt: Date;
}

const ticketEventSchema = new Schema<ITicketEvent>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eventType: { type: String, enum: TICKET_EVENT_TYPES, required: true },
    fromStatus: { type: String, enum: TICKET_STATUSES, default: null },
    toStatus: { type: String, enum: TICKET_STATUSES, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ticketEventSchema.index({ ticketId: 1, createdAt: 1 });
ticketEventSchema.index(
  { ticketId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

export const TicketEventModel = mongoose.model<ITicketEvent>('TicketEvent', ticketEventSchema);
