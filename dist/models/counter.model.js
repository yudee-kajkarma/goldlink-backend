import mongoose from "mongoose";
const counterSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // Format: YYYY-MM
    seq: { type: Number, default: 0 },
});
export const Counter = mongoose.model("Counter", counterSchema);
//# sourceMappingURL=counter.model.js.map