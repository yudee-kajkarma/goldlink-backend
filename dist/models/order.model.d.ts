import mongoose, { Document } from 'mongoose';
export interface IOrder extends Document {
    orderCode: string;
    createdBy: mongoose.Types.ObjectId;
    assignedTo: mongoose.Types.ObjectId;
    jewelleryType: "Ring" | "Necklace" | "Bangle" | "Earring" | "Pendant";
    metalType: "Gold" | "Silver" | "Platinum" | "Rose Gold";
    weight?: number;
    designNotes?: string;
    purity?: string;
    status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "QUALITY_CHECK" | "COMPLETED" | "RECEIVED" | "ON_HOLD" | "REVISION_REQUESTED";
    priority: "NORMAL" | "URGENT" | "EXPRESS";
    expectedDeliveryDate?: Date;
    customerRef?: string;
    totalAmount: number;
    advancePaid: number;
    completionNote?: string;
    images: Array<{
        key: string;
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
        issuedWeight: number;
        returnedWeight: number;
        wastage: number;
        loggedBy: mongoose.Types.ObjectId;
        loggedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
    id?: string;
    orderId?: string;
}
export declare const Order: mongoose.Model<IOrder, {}, {}, {}, mongoose.Document<unknown, {}, IOrder, {}, {}> & IOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Order;
