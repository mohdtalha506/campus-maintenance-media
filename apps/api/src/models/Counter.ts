import mongoose, { Schema } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 1000 },
});

export const CounterModel = mongoose.model<ICounter>('Counter', counterSchema);

export async function getNextTicketNumber(): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: 'ticketNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `CMP-${counter.seq}`;
}
