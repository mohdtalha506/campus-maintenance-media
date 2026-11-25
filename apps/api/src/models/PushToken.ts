import mongoose, { Schema, type Document } from 'mongoose';

export interface PushTokenDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'android' | 'ios' | 'web';
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<PushTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
  },
  { timestamps: true }
);

export const PushTokenModel = mongoose.model<PushTokenDocument>('PushToken', pushTokenSchema);
