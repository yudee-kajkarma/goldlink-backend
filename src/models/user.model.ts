import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends mongoose.Document {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  role: "ADMIN" | "STAFF" | "KARIGAR";
  isApproved: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  isActive: boolean;
  lastLogin?: Date;
  /** Legacy single-token field kept in sync with the latest device token. */
  fcmToken?: string;
  fcmTokens?: string[];
  language: "EN" | "HI";
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["ADMIN", "STAFF", "KARIGAR"],
      required: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    isActive: {
      type: Boolean,
      default: false,
    },
    lastLogin: Date,
    fcmToken: String,
    fcmTokens: { type: [String], default: [] },
    language: {
      type: String,
      enum: ["EN", "HI"],
      default: "EN",
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isApproved: 1 });

// Prevent "ghost users" (documents with neither email nor phone).
userSchema.pre('validate', function (next) {
  if (typeof this.email === 'string') this.email = this.email.trim().toLowerCase();
  if (typeof this.phone === 'string') this.phone = this.phone.trim().replace(/\s+/g, '');
  const hasEmail = typeof this.email === 'string' && this.email.length > 0;
  const hasPhone = typeof this.phone === 'string' && this.phone.length > 0;
  if (!hasEmail && !hasPhone) {
    return next(new Error('Either email or phone is required'));
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  // Enforce minimum password length before hashing.
  if (typeof this.password === 'string' && this.password.length < 8) {
    return next(new Error('Password must be at least 8 characters long'));
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model<IUser>("User", userSchema);
