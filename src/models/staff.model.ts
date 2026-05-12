import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeCode: String,
    department: String,
    designation: String,
    joiningDate: Date,
    assignedKarigars: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Staff", staffSchema);
