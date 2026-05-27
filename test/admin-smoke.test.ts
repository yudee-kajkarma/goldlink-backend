/**
 * E2E smoke test: verifies the seeded admin can create STAFF and KARIGAR
 * users through the real /api/admin/users HTTP route, that the new accounts
 * land in MongoDB with the right flags, and that a STAFF can immediately
 * log in via /api/auth/login.
 *
 * Hits the live MongoDB pointed at by .env. Skips itself if MONGO_URI or
 * JWT_SECRET are not set. Cleans up every record it inserts.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Rate limiter is module-load gated on env — turn it off before any route imports.
process.env.DISABLE_RATE_LIMIT = '1';

const haveCreds = Boolean(process.env.MONGO_URI && process.env.JWT_SECRET);
if (!haveCreds) {
  console.warn('[admin-smoke] MONGO_URI or JWT_SECRET missing — skipping suite');
}

const RUN_ID = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const adminEmail = `${RUN_ID}-admin@goldlink.test`;
const staffEmail = `${RUN_ID}-staff@goldlink.test`;
const karigarEmail = `${RUN_ID}-karigar@goldlink.test`;
const PASSWORD = 'Smoke@TestPass1';

// Dynamically import everything that touches env/Mongoose AFTER dotenv runs.
const mongoose = (await import('mongoose')).default;
const express = (await import('express')).default;
const jwt = (await import('jsonwebtoken')).default;
const request = (await import('supertest')).default;
const { default: User } = await import('../src/models/user.model.ts');
const { default: Staff } = await import('../src/models/staff.model.ts');
const { default: Karigar } = await import('../src/models/karigar.model.ts');
const { default: authRoutes } = await import('../src/routes/auth.routes.ts');
const { default: adminRoutes } = await import('../src/routes/admin.routes.ts');

// Minimal app mirroring src/index.ts wiring — no socket, no scheduled jobs.
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

let adminId: string;
let adminToken: string;
const createdUserIds: string[] = [];

before(async () => {
  if (!haveCreds) return;
  await mongoose.connect(process.env.MONGO_URI as string, { serverSelectionTimeoutMS: 15_000 });

  // Seed an isolated admin so the test never collides with the real seeded admin.
  const admin = await User.create({
    name: 'Smoke Test Admin',
    email: adminEmail,
    password: PASSWORD,
    role: 'ADMIN',
    isApproved: true,
    isActive: true,
  });
  adminId = admin._id.toString();
  adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
});

after(async () => {
  if (!haveCreds) return;
  try {
    const allIds = [adminId, ...createdUserIds].filter(Boolean);
    if (allIds.length) {
      await Promise.all([
        User.deleteMany({ _id: { $in: allIds } }),
        Staff.deleteMany({ user: { $in: allIds } }),
        Karigar.deleteMany({ user: { $in: allIds } }),
      ]);
    }
  } finally {
    await mongoose.disconnect();
  }
});

test('admin-smoke: MongoDB connection is live', { skip: !haveCreds }, () => {
  assert.equal(mongoose.connection.readyState, 1, 'mongoose should be connected (1)');
});

test('admin-smoke: seeded admin exists and is approved+active', { skip: !haveCreds }, async () => {
  const found = await User.findById(adminId);
  assert.ok(found, 'admin should be persisted');
  assert.equal(found?.role, 'ADMIN');
  assert.equal(found?.isApproved, true);
  assert.equal(found?.isActive, true);
});

test(
  'admin-smoke: admin can create a STAFF user via POST /api/admin/users',
  { skip: !haveCreds },
  async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Smoke Staff',
        email: staffEmail,
        password: PASSWORD,
        role: 'STAFF',
        department: 'Sales',
        designation: 'Counter Staff',
      });

    assert.equal(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.role, 'STAFF');
    assert.equal(res.body.data.isApproved, true);
    assert.equal(res.body.data.isActive, true);

    const newUserId = String(res.body.data._id);
    createdUserIds.push(newUserId);

    // The model exists, password is hashed (not the plaintext), and a Staff profile was created.
    const userDoc = await User.findById(newUserId).select('+password');
    assert.ok(userDoc, 'staff user should be persisted');
    assert.notEqual(userDoc?.password, PASSWORD, 'password must be hashed');
    assert.equal(await userDoc!.matchPassword(PASSWORD), true, 'matchPassword should succeed');

    const profile = await Staff.findOne({ user: newUserId });
    assert.ok(profile, 'Staff profile document should be created');
    assert.equal(profile?.department, 'Sales');
    assert.equal(profile?.designation, 'Counter Staff');
  }
);

test(
  'admin-smoke: admin can create a KARIGAR user via POST /api/admin/users',
  { skip: !haveCreds },
  async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Smoke Karigar',
        email: karigarEmail,
        password: PASSWORD,
        role: 'KARIGAR',
        skillType: 'Goldsmith',
        experienceYears: 5,
      });

    assert.equal(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.data.role, 'KARIGAR');
    assert.equal(res.body.data.isApproved, true);

    const newUserId = String(res.body.data._id);
    createdUserIds.push(newUserId);

    const profile = await Karigar.findOne({ user: newUserId });
    assert.ok(profile, 'Karigar profile document should be created');
    assert.equal(profile?.skillType, 'Goldsmith');
    assert.equal(profile?.experienceYears, 5);
  }
);

test(
  'admin-smoke: newly-created STAFF can log in immediately',
  { skip: !haveCreds },
  async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: staffEmail, password: PASSWORD, role: 'STAFF' });

    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.data.role, 'STAFF');
    assert.ok(res.body.data.token, 'login response should include a JWT');
  }
);

test(
  'admin-smoke: duplicate email is rejected by the create-user route',
  { skip: !haveCreds },
  async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Smoke Staff Dup',
        email: staffEmail, // already used in the STAFF test above
        password: PASSWORD,
        role: 'STAFF',
      });

    assert.equal(res.status, 400, `expected 400 on duplicate email, got ${res.status}`);
    assert.equal(res.body.success, false);
  }
);

test(
  'admin-smoke: non-admin token is rejected by /api/admin/users',
  { skip: !haveCreds },
  async () => {
    // Register a self-signup staff (not yet approved) and try to reuse their flow.
    const staffOnly = await User.create({
      name: 'Smoke Non-Admin',
      email: `${RUN_ID}-nonadmin@goldlink.test`,
      password: PASSWORD,
      role: 'STAFF',
      isApproved: true, // approve so we get past the `protect` middleware
      isActive: true,
    });
    createdUserIds.push(staffOnly._id.toString());

    const staffToken = jwt.sign(
      { id: staffOnly._id.toString() },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Should Fail',
        email: `${RUN_ID}-shouldfail@goldlink.test`,
        password: PASSWORD,
        role: 'STAFF',
      });

    assert.equal(res.status, 403, `expected 403 for non-admin caller, got ${res.status}`);
  }
);
