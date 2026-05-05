import { Order } from '../models/order.model.js';
import { User } from '../models/user.model.js';
export const getOverviewStats = async () => {
    const stats = await Order.aggregate([
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                completedOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
                },
                pendingOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
                },
                inProgressOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] }
                },
                totalValue: { $sum: "$totalAmount" },
                totalAdvance: { $sum: "$advancePaid" }
            }
        }
    ]);
    const userStats = await User.aggregate([
        {
            $group: {
                _id: "$role",
                count: { $sum: 1 }
            }
        }
    ]);
    return {
        orders: stats[0] || {},
        users: userStats
    };
};
export const getOrdersByKarigar = async () => {
    return await Order.aggregate([
        {
            $group: {
                _id: "$assignedTo",
                totalOrders: { $sum: 1 },
                completedOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
                },
                avgWastage: { $avg: { $arrayElemAt: ["$materialLogs.wastage", -1] } }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "karigar"
            }
        },
        { $unwind: "$karigar" },
        {
            $project: {
                "karigar.name": 1,
                "karigar.email": 1,
                totalOrders: 1,
                completedOrders: 1,
                avgWastage: 1,
                completionRate: {
                    $multiply: [{ $divide: ["$completedOrders", "$totalOrders"] }, 100]
                }
            }
        }
    ]);
};
export const getMonthlyTrend = async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: sixMonthsAgo }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" }
                },
                count: { $sum: 1 },
                amount: { $sum: "$totalAmount" }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);
};
export const getOverdueOrders = async () => {
    return await Order.find({
        status: { $nin: ["COMPLETED", "RECEIVED"] },
        expectedDeliveryDate: { $lt: new Date() }
    }).populate('assignedTo', 'name');
};
export const getJewelleryTypeStats = async () => {
    return await Order.aggregate([
        {
            $group: {
                _id: "$jewelleryType",
                count: { $sum: 1 },
                totalAmount: { $sum: "$totalAmount" }
            }
        }
    ]);
};
//# sourceMappingURL=analytics.service.js.map