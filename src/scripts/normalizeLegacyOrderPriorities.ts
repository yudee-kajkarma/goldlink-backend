/**
 * Optional: persist canonical priorities in MongoDB (HIGH/LOW -> URGENT/NORMAL).
 * Run: npx tsx src/scripts/normalizeLegacyOrderPriorities.ts
 */
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Order from '../models/order.model.js';

const MONGO_URI = process.env.MONGO_URI as string;

async function main() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const hi = await Order.updateMany({ priority: 'HIGH' }, { $set: { priority: 'URGENT' } });
  const lo = await Order.updateMany({ priority: 'LOW' }, { $set: { priority: 'NORMAL' } });
  console.log('normalize order priorities:', { highToUrgent: hi.modifiedCount, lowToNormal: lo.modifiedCount });
  await mongoose.disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
