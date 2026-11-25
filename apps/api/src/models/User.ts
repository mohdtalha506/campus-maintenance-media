import mongoose, { Schema, type Document } from 'mongoose';
import { USER_ROLES, type UserRole } from '@campus/shared';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>('User', userSchema);
