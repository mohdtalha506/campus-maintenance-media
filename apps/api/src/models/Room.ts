import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IRoom extends Document {
  buildingId: Types.ObjectId;
  name: string;
  roomNumber: string;
  floor: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    buildingId: { type: Schema.Types.ObjectId, ref: 'Building', required: true, index: true },
    name: { type: String, required: true, trim: true },
    roomNumber: { type: String, required: true, trim: true },
    floor: { type: String, default: 'Ground', trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

roomSchema.index({ buildingId: 1, roomNumber: 1 }, { unique: true });

export const RoomModel = mongoose.model<IRoom>('Room', roomSchema);
