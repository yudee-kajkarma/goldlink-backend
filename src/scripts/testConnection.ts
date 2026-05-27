import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwdEnvPath = path.resolve(process.cwd(), '.env');
const scriptEnvPath = path.resolve(__dirname, '../../.env');
const envPath = fs.existsSync(cwdEnvPath) ? cwdEnvPath : scriptEnvPath;
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('FAIL: MONGO_URI is not set in .env');
  process.exit(1);
}

const safeUri = MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
console.log(`Connecting to: ${safeUri}`);

const t0 = Date.now();
try {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15_000 });
  const ms = Date.now() - t0;
  const db = mongoose.connection.db;
  if (!db) throw new Error('mongoose.connection.db is undefined after connect');

  const ping = await db.admin().ping();
  const dbName = mongoose.connection.name;
  const collections = await db.listCollections().toArray();

  console.log(`OK: connected in ${ms}ms`);
  console.log(`   database: ${dbName}`);
  console.log(`   ping:     ${JSON.stringify(ping)}`);
  console.log(`   collections (${collections.length}): ${collections.map((c) => c.name).join(', ') || '(none)'}`);

  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('FAIL: connection error');
  console.error(err);
  process.exit(1);
}
