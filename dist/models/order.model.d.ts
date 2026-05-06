import mongoose, { Document } from 'mongoose';
export interface IOrder extends Document {
    orderCode: string;
    createdBy: mongoose.Types.ObjectId;
    assignedTo: mongoose.Types.ObjectId;
    jewelleryType: "Ring" | "Necklace" | "Bangle" | "Earring" | "Pendant";
    metalType: "Gold" | "Silver" | "Platinum" | "Rose Gold";
    weight?: number;
    designNotes?: string;
    completionNote?: string;
    purity?: string;
    status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "QUALITY_CHECK" | "COMPLETED" | "RECEIVED" | "ON_HOLD" | "REVISION_REQUESTED";
    priority: "NORMAL" | "URGENT" | "EXPRESS";
    expectedDeliveryDate?: Date;
    customerRef?: string;
    images: Array<{
        url: string;
        type: "INITIAL" | "COMPLETION";
    }>;
    statusLogs: Array<{
        status: string;
        updatedBy: mongoose.Types.ObjectId;
        createdAt: Date;
    }>;
    payments: Array<{
        amount: number;
        type: "ADVANCE" | "FINAL";
        status: "PAID" | "PENDING";
        paidAt: Date;
    }>;
    materialLogs: Array<{
        issuedWeight?: number;
        returnedWeight?: number;
        wastage?: number;
        loggedBy: mongoose.Types.ObjectId;
        loggedAt: Date;
    }>;
    /** Order total for balance-due (PRD 4.5); sum of paid payments subtracted in balanceDue virtual. */
    totalAmount?: number;
    reminder24hSentAt?: Date;
    overdueNotifiedAt?: Date;
    idle3DayNotifiedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    id?: string;
    orderId?: string;
    balanceDue?: number;
}
declare const _default: mongoose.Model<IOrder, {}, {}, {}, mongoose.Document<unknown, {}, IOrder, {}, {}> & IOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=order.model.d.ts.map