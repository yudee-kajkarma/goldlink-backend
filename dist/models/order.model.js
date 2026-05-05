import mongoose, { Schema } from 'mongoose';
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
    totalAmount: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    //  Images
    images: [
        {
            key: { type: String, required: true },
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
            issuedWeight: { type: Number, default: 0 },
            returnedWeight: { type: Number, default: 0 },
            wastage: { type: Number, default: 0 },
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
orderSchema.index({ assignedTo: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
// Virtuals
orderSchema.virtual('orderId').get(function () {
    return this._id.toString();
});
orderSchema.virtual('balanceDue').get(function () {
    return (this.totalAmount || 0) - (this.advancePaid || 0);
});
// Pre-save hook for wastage calculation
orderSchema.pre('save', function (next) {
    if (this.isModified('materialLogs')) {
        this.materialLogs.forEach(log => {
            if (log.issuedWeight != null && log.returnedWeight != null) {
                log.wastage = Math.max(0, log.issuedWeight - log.returnedWeight);
            }
        });
    }
    next();
});
export const Order = mongoose.model("Order", orderSchema);
export default Order;
//# sourceMappingURL=order.model.js.map