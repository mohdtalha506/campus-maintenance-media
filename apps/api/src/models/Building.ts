import mongoose, { Schema, type Document } from 'mongoose';

export interface IBuilding extends Document {
  name: string;
  code: string;
  description: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const buildingSchema = new Schema<IBuilding>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const BuildingModel = mongoose.model<IBuilding>('Building', buildingSchema);
