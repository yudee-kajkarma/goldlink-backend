import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/user.model.js';

// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const createAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in the .env file.');
      process.exit(1);
    }

    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error('Error: MONGO_URI must be defined in the .env file.');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if an admin with this email already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`Admin user with email ${adminEmail} already exists.`);
      process.exit(0);
    }

    // Create the admin user
    // Note: The User model already has a pre-save hook that hashes the password with bcrypt,
    // so we don't need to manually hash it here.
    const adminUser = new User({
      name: 'Super Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'ADMIN',
      isApproved: true,
      isActive: true,
    });

    await adminUser.save();
    console.log(`Admin user ${adminEmail} created successfully.`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();
