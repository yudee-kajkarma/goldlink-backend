import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
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

userSchema.pre("save", async function (next) {
  // #region agent log
  fetch('http://127.0.0.1:7717/ingest/705e965c-2004-4b41-b2ed-21f96665174a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'033cf0'},body:JSON.stringify({sessionId:'033cf0',runId:'pre-fix',hypothesisId:'H1',location:'models/user.model.ts:41',message:'user pre-save invoked',data:{isModifiedPassword:this.isModified("password"),hasPassword:typeof this.password==='string'&&this.password.length>0},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!this.isModified("password")) {
    return next();
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

export default mongoose.model("User", userSchema);
