import { Counter } from "../models/counter.model.js";
export const generateOrderCode = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    const counter = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
    const sequence = String(counter.seq).padStart(3, "0");
    return `ORD-${year}-${month}-${sequence}`;
};
//# sourceMappingURL=orderCode.js.map