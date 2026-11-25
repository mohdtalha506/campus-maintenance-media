import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  MAINTENANCE_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type MaintenanceCategory,
  type TicketPriority,
  type TicketStatus,
} from '@campus/shared';

export interface IAiDraftSubdoc {
  title: string;
  description: string;
  suggestedCategory: MaintenanceCategory;
  transcript: string;
  model: string;
  generatedAt: Date;
  isMock: boolean;
}

export interface ITicket extends Document {
  ticketNumber: string;
  clientSubmissionId: string;
  reporterId: Types.ObjectId;
  buildingId: Types.ObjectId;
  roomId: Types.ObjectId;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: Types.ObjectId | null;
  aiDraft: IAiDraftSubdoc | null;
  completionNote: string | null;
  reopenReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const aiDraftSchema = new Schema<IAiDraftSubdoc>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    suggestedCategory: { type: String, enum: MAINTENANCE_CATEGORIES, required: true },
    transcript: { type: String, required: true },
    model: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    isMock: { type: Boolean, required: true },
  },
  { _id: false }
);

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: String, required: true, unique: true },
    clientSubmissionId: { type: String, required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buildingId: { type: Schema.Types.ObjectId, ref: 'Building', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, enum: MAINTENANCE_CATEGORIES, required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'Medium' },
    status: { type: String, enum: TICKET_STATUSES, default: 'New' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    aiDraft: { type: aiDraftSchema, default: null },
    completionNote: { type: String, default: null },
    reopenReason: { type: String, default: null },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

ticketSchema.index({ clientSubmissionId: 1 }, { unique: true });
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ priority: 1, status: 1 });
ticketSchema.index({ category: 1, status: 1 });
ticketSchema.index({ buildingId: 1, status: 1 });
ticketSchema.index({ assigneeId: 1, status: 1 });
ticketSchema.index({ reporterId: 1, createdAt: -1 });
ticketSchema.index({ title: 'text', description: 'text', ticketNumber: 'text' });

export const TicketModel = mongoose.model<ITicket>('Ticket', ticketSchema);
