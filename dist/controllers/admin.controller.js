import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/user.model.js';
import { Order } from '../models/order.model.js';
import { AppError } from '../utils/AppError.js';
import { Message } from '../models/message.model.js';
import * as analyticsService from '../services/analytics.service.js';
import * as exportService from '../services/export.service.js';
import { createUserSchema } from '../validators/auth.validator.js';
// --- USER MANAGEMENT ---
export const getUsers = asyncHandler(async (req, res) => {
    const { role, isApproved } = req.query;
    let query = {};
    if (role)
        query.role = role;
    if (isApproved !== undefined)
        query.isApproved = isApproved === 'true';
    const users = await User.find(query).select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
});
export const createUser = asyncHandler(async (req, res) => {
    const validatedData = createUserSchema.parse(req.body);
    const existingUser = await User.findOne({
        $or: [
            { email: validatedData.email },
            { phone: validatedData.phone }
        ].filter(Boolean)
    });
    if (existingUser) {
        throw new AppError('User already exists with this email or phone', 400, 'GL_400');
    }
    const user = await User.create({
        ...validatedData,
        isApproved: validatedData.isApproved ?? true,
        isActive: validatedData.isActive ?? true,
        approvedBy: req.user?._id,
        approvedAt: new Date()
    });
    res.status(201).json({ success: true, data: user });
});
export const approveUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user)
        throw new AppError('User not found', 404, 'GL_404');
    user.isApproved = true;
    user.isActive = true;
    user.approvedBy = req.user?._id;
    user.approvedAt = new Date();
    await user.save();
    res.status(200).json({ success: true, message: 'User approved successfully', data: user });
});
export const deactivateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user)
        throw new AppError('User not found', 404, 'GL_404');
    user.isActive = false;
    await user.save();
    res.status(200).json({ success: true, message: 'User deactivated successfully' });
});
export const resetPassword = asyncHandler(async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 8) {
        throw new AppError('Valid password is required', 400, 'GL_400');
    }
    const user = await User.findById(req.params.id);
    if (!user)
        throw new AppError('User not found', 404, 'GL_404');
    user.password = password;
    await user.save();
    res.status(200).json({ success: true, message: 'Password reset successfully' });
});
// --- ORDER OVERSIGHT ---
export const getOrders = asyncHandler(async (req, res) => {
    const { status, karigar, staff, type } = req.query;
    let query = {};
    if (status)
        query.status = status;
    if (karigar)
        query.assignedTo = karigar;
    if (staff)
        query.createdBy = staff;
    if (type)
        query.jewelleryType = type;
    const orders = await Order.find(query)
        .populate('createdBy', 'name email phone')
        .populate('assignedTo', 'name email phone')
        .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, data: orders });
});
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('createdBy', 'name email phone')
        .populate('assignedTo', 'name email phone');
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    res.status(200).json({ success: true, data: order });
});
export const reassignOrder = asyncHandler(async (req, res) => {
    const { karigarId } = req.body;
    if (!karigarId)
        throw new AppError('karigarId is required', 400, 'GL_400');
    const order = await Order.findById(req.params.id);
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    const karigar = await User.findOne({ _id: karigarId, role: 'KARIGAR', isActive: true, isApproved: true });
    if (!karigar)
        throw new AppError('Invalid or inactive Karigar selected', 400, 'GL_400');
    order.assignedTo = karigarId;
    order.statusLogs.push({
        status: 'REASSIGNED',
        updatedBy: req.user?._id,
        createdAt: new Date()
    });
    await order.save();
    res.status(200).json({ success: true, message: 'Order reassigned successfully', data: order });
});
// --- ANALYTICS ---
export const getOverview = asyncHandler(async (req, res) => {
    const data = await analyticsService.getOverviewStats();
    res.status(200).json({ success: true, data });
});
export const getOrdersByKarigar = asyncHandler(async (req, res) => {
    const data = await analyticsService.getOrdersByKarigar();
    res.status(200).json({ success: true, data });
});
export const getMonthlyTrend = asyncHandler(async (req, res) => {
    const data = await analyticsService.getMonthlyTrend();
    res.status(200).json({ success: true, data });
});
export const getOverdue = asyncHandler(async (req, res) => {
    const data = await analyticsService.getOverdueOrders();
    res.status(200).json({ success: true, data });
});
// --- EXPORT ---
export const exportOrders = asyncHandler(async (req, res) => {
    const { format } = req.query;
    if (format === 'csv') {
        return await exportService.exportOrdersCSV(res);
    }
    else if (format === 'pdf') {
        return await exportService.exportOrdersPDF(res);
    }
    else {
        throw new AppError('Invalid export format. Use csv or pdf', 400, 'GL_400');
    }
});
// --- CHATS & CALLS (MF4, MF5) ---
export const getAllChats = asyncHandler(async (req, res) => {
    // Aggregate all chats view
    const recentMessages = await Message.aggregate([
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: "$orderId",
                latestMessage: { $first: "$$ROOT" }
            }
        },
        {
            $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "_id",
                as: "order"
            }
        },
        { $unwind: "$order" }
    ]);
    res.status(200).json({ success: true, data: recentMessages });
});
export const getOrderChats = asyncHandler(async (req, res) => {
    const messages = await Message.find({ orderId: req.params.orderId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: messages });
});
export const flagChat = asyncHandler(async (req, res) => {
    const msg = await Message.findById(req.params.id);
    if (!msg)
        throw new AppError('Message not found', 404, 'GL_404');
    msg.isFlagged = true;
    await msg.save();
    res.status(200).json({ success: true, message: 'Message flagged for review' });
});
export const flagCall = asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, message: 'Call flagged for review' });
});
//# sourceMappingURL=admin.controller.js.map