import mongoose, { Schema, type Document } from 'mongoose';
import { TICKET_EVENT_TYPES, type TicketEventType } from '@campus/shared';

export interface NotificationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  ticketId: mongoose.Types.ObjectId | null;
  ticketNumber: string | null;
  title: string;
  body: string;
  eventType: TicketEventType;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', default: null },
    ticketNumber: { type: String, default: null },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    eventType: { type: String, enum: TICKET_EVENT_TYPES, required: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<NotificationDocument>(
  'Notification',
  notificationSchema
);
