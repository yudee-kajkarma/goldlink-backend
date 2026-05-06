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
  fcmToken?: string;
  language: "EN" | "HI";
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
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
  const hasEmail = typeof this.email === 'string' && this.email.trim().length > 0;
  const hasPhone = typeof this.phone === 'string' && this.phone.trim().length > 0;
  if (!hasEmail && !hasPhone) {
    return next(new Error('Either email or phone is required'));
  }
  next();
});

userSchema.pre("save", async function (next) {
  // #region agent log
  fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H1',location:'models/user.model.ts:41',message:'user pre-save invoked',data:{isModifiedPassword:this.isModified("password"),hasPassword:typeof this.password==='string'&&this.password.length>0},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!this.isModified("password")) {
    return next();
  }

  // Enforce minimum password length before hashing.
  if (typeof this.password === 'string' && this.password.length < 8) {
    return next(new Error('Password must be at least 8 characters long'));
  }

  const salt = await bcrypt.genSalt(10);
  // #region agent log
  fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H1',location:'models/user.model.ts:46',message:'password hashing branch executed',data:{isModifiedPassword:this.isModified("password")},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model<IUser>("User", userSchema);
