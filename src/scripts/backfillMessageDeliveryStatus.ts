/**
 * One-time: set `status` on Message docs that predate the field.
 * Run: npx tsx src/scripts/backfillMessageDeliveryStatus.ts
 */
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Message } from '../models/message.model.js';

const MONGO_URI = process.env.MONGO_URI as string;

async function main() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const r1 = await Message.updateMany({ isRead: true, status: { $ne: 'READ' } }, { $set: { status: 'READ' } });
  const r2 = await Message.updateMany(
    {
      isRead: { $ne: true },
      isDelivered: true,
      status: { $nin: ['READ', 'DELIVERED'] },
    },
    { $set: { status: 'DELIVERED' } }
  );
  const r3 = await Message.updateMany(
    {
      isRead: { $ne: true },
      isDelivered: { $ne: true },
      $or: [{ status: { $exists: false } }, { status: null }],
    },
    { $set: { status: 'SENT' } }
  );
  console.log('backfill message status:', {
    markedRead: r1.modifiedCount,
    markedDelivered: r2.modifiedCount,
    markedSent: r3.modifiedCount,
  });
  await mongoose.disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
