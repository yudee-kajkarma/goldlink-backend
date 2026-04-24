import mongoose from "mongoose";

const karigarSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    skillType: String,
    experienceYears: Number,
    address: String,
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Karigar", karigarSchema);
