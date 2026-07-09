import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import Karigar from '../models/karigar.model.js';

// Load environment variables from the root .env file (same pattern as createAdmin.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const explicitEnv = process.env.DOTENV_PATH
  ? path.resolve(process.env.DOTENV_PATH)
  : undefined;
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const scriptEnvPath = path.resolve(__dirname, '../.env');
let envPath = scriptEnvPath;
if (explicitEnv && fs.existsSync(explicitEnv)) {
  envPath = explicitEnv;
} else if (fs.existsSync(cwdEnvPath)) {
  envPath = cwdEnvPath;
}
dotenv.config({ path: envPath });

type Role = 'ADMIN' | 'STAFF' | 'KARIGAR';

interface AccountSpec {
  role: Role;
  name: string;
  email: string;
  password: string;
  staffMeta?: { department: string; designation: string };
  karigarMeta?: { skillType: string; experienceYears: number };
}

// 16-char password: starts with `Rv9!` to guarantee upper+lower+digit+symbol
// (passes Play Console's strength checks), rest is URL-safe base64 entropy.
const generatePassword = (): string => {
  const raw = crypto
    .randomBytes(24)
    .toString('base64')
    .replace(/[+/=]/g, '');
  return `Rv9!${raw}`.slice(0, 16);
};

const REVIEW_DOMAIN =
  process.env.REVIEW_EMAIL_DOMAIN || 'sonigoldlink-review.example.com';

const buildSpecs = (): AccountSpec[] => {
  const adminPwd = process.env.REVIEW_ADMIN_PASSWORD || generatePassword();
  const staffPwd = process.env.REVIEW_STAFF_PASSWORD || generatePassword();
  const karigarPwd = process.env.REVIEW_KARIGAR_PASSWORD || generatePassword();

  return [
    {
      role: 'ADMIN',
      name: 'Play Review Admin',
      email: (
        process.env.REVIEW_ADMIN_EMAIL || `playreview-admin@${REVIEW_DOMAIN}`
      ).toLowerCase(),
      password: adminPwd,
    },
    {
      role: 'STAFF',
      name: 'Play Review Staff',
      email: (
        process.env.REVIEW_STAFF_EMAIL || `playreview-staff@${REVIEW_DOMAIN}`
      ).toLowerCase(),
      password: staffPwd,
      staffMeta: { department: 'Operations', designation: 'Senior Staff' },
    },
    {
      role: 'KARIGAR',
      name: 'Play Review Karigar',
      email: (
        process.env.REVIEW_KARIGAR_EMAIL ||
        `playreview-karigar@${REVIEW_DOMAIN}`
      ).toLowerCase(),
      password: karigarPwd,
      karigarMeta: { skillType: 'Goldsmith', experienceYears: 10 },
    },
  ];
};

const upsertAccount = async (
  spec: AccountSpec
): Promise<{ action: 'created' | 'updated' }> => {
  let user = await User.findOne({ email: spec.email });
  const action: 'created' | 'updated' = user ? 'updated' : 'created';

  if (!user) {
    user = new User({
      name: spec.name,
      email: spec.email,
      password: spec.password,
      role: spec.role,
      isApproved: true,
      isActive: true,
    });
  } else {
    user.name = spec.name;
    user.role = spec.role;
    user.isApproved = true;
    user.isActive = true;
    // pre('save') hook re-hashes when password is modified
    user.password = spec.password;
  }

  await user.save();

  if (spec.role === 'STAFF' && spec.staffMeta) {
    await Staff.findOneAndUpdate(
      { user: user._id },
      { user: user._id, ...spec.staffMeta },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else if (spec.role === 'KARIGAR' && spec.karigarMeta) {
    await Karigar.findOneAndUpdate(
      { user: user._id },
      { user: user._id, ...spec.karigarMeta, isAvailable: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return { action };
};

const titleCase = (role: Role): string =>
  role.charAt(0) + role.slice(1).toLowerCase();

const main = async () => {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error(
      'Error: MONGO_URI must be defined in the .env file.'
    );
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const specs = buildSpecs();
  const results: Array<{ spec: AccountSpec; action: 'created' | 'updated' }> =
    [];

  console.log('Seeding Google Play review accounts...');
  for (const spec of specs) {
    const { action } = await upsertAccount(spec);
    results.push({ spec, action });
    console.log(
      `  ${action.padEnd(7)}  ${spec.role.padEnd(7)}  ${spec.email}`
    );
  }

  console.log(
    '\n================================================================='
  );
  console.log(
    '  GOOGLE PLAY REVIEW CREDENTIALS  --  paste each into Play Console'
  );
  console.log(
    '  (Test and release > App content > Sign in details > Add)'
  );
  console.log(
    '=================================================================\n'
  );

  for (const { spec } of results) {
    console.log(`[${spec.role}]`);
    console.log(`  Name field:    ${titleCase(spec.role)} account`);
    console.log(`  Email:         ${spec.email}`);
    console.log(`  Password:      ${spec.password}`);
    console.log('');
  }

  console.log(
    '================================================================='
  );
  console.log(
    '  All three accounts are isApproved=true, isActive=true.'
  );
  console.log(
    '  Re-run this script to rotate passwords before each Play submission.'
  );
  console.log(
    '  Override defaults via env vars:'
  );
  console.log(
    '    REVIEW_EMAIL_DOMAIN, REVIEW_ADMIN_EMAIL, REVIEW_ADMIN_PASSWORD,'
  );
  console.log(
    '    REVIEW_STAFF_EMAIL,  REVIEW_STAFF_PASSWORD,'
  );
  console.log(
    '    REVIEW_KARIGAR_EMAIL, REVIEW_KARIGAR_PASSWORD'
  );
  console.log(
    '=================================================================\n'
  );

  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
