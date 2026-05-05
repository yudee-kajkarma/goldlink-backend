import mongoose from 'mongoose';
export declare const getOverviewStats: () => Promise<{
    orders: any;
    users: any[];
}>;
export declare const getOrdersByKarigar: () => Promise<any[]>;
export declare const getMonthlyTrend: () => Promise<any[]>;
export declare const getOverdueOrders: () => Promise<(mongoose.Document<unknown, {}, import("../models/order.model.js").IOrder, {}, {}> & import("../models/order.model.js").IOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
})[]>;
export declare const getJewelleryTypeStats: () => Promise<any[]>;
