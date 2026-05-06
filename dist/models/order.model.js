import mongoose, { Document, Schema } from 'mongoose';
const orderSchema = new Schema({
    orderCode: { type: String, unique: true, required: true },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    jewelleryType: {
        type: String,
        enum: ["Ring", "Necklace", "Bangle", "Earring", "Pendant"],
        required: true,
    },
    metalType: {
        type: String,
        enum: ["Gold", "Silver", "Platinum", "Rose Gold"],
        required: true,
    },
    weight: Number,
    designNotes: String,
    completionNote: String,
    purity: String,
    status: {
        type: String,
        enum: [
            "PENDING",
            "ACCEPTED",
            "IN_PROGRESS",
            "QUALITY_CHECK",
            "COMPLETED",
            "RECEIVED",
            "ON_HOLD",
            "REVISION_REQUESTED",
        ],
        default: "PENDING",
    },
    priority: {
        type: String,
        enum: ["NORMAL", "URGENT", "EXPRESS"],
        default: "NORMAL",
    },
    expectedDeliveryDate: Date,
    customerRef: String,
    totalAmount: { type: Number, min: 0 },
    reminder24hSentAt: Date,
    overdueNotifiedAt: Date,
    idle3DayNotifiedAt: Date,
    //  Images
    images: [
        {
            url: String,
            type: {
                type: String,
                enum: ["INITIAL", "COMPLETION"],
                default: "INITIAL",
            },
        },
    ],
    //  Status Logs
    statusLogs: [
        {
            status: String,
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    //  Payments (Embedded)
    payments: [
        {
            amount: Number,
            type: {
                type: String,
                enum: ["ADVANCE", "FINAL"],
            },
            status: {
                type: String,
                enum: ["PAID", "PENDING"],
                default: "PAID",
            },
            paidAt: { type: Date, default: Date.now },
        },
    ],
    //  Material Logs (Embedded)
    materialLogs: [
        {
            issuedWeight: Number,
            returnedWeight: Number,
            wastage: Number,
            loggedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            loggedAt: { type: Date, default: Date.now },
        },
    ],
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Indexes
// orderCode is already unique, so we don't need a separate index definition here
orderSchema.index({ assignedTo: 1 });
orderSchema.index({ status: 1 });
// Virtuals
orderSchema.virtual('orderId').get(function () {
    return this._id.toString();
});
orderSchema.virtual('balanceDue').get(function () {
    const total = this.totalAmount;
    if (total == null || Number.isNaN(Number(total))) {
        return undefined;
    }
    const paid = (this.payments ?? [])
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return Math.max(0, Number(total) - paid);
});
export default mongoose.model("Order", orderSchema);
//# sourceMappingURL=order.model.js.map