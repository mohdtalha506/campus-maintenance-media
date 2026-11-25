import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { ATTACHMENT_KINDS, type AttachmentKind } from '@campus/shared';

export interface IAttachment extends Document {
  ticketId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  kind: AttachmentKind;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ATTACHMENT_KINDS, required: true },
    storageKey: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

attachmentSchema.index({ ticketId: 1, kind: 1 });

export const AttachmentModel = mongoose.model<IAttachment>('Attachment', attachmentSchema);
