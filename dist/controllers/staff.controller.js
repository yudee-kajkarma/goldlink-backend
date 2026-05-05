import { asyncHandler } from '../utils/asyncHandler.js';
import { Order } from '../models/order.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { generateOrderCode } from '../utils/orderCode.js';
import { uploadToS3, getSignedS3Url } from '../services/s3.service.js';
import { createOrderSchema, updateOrderSchema, updateStatusSchema } from '../validators/order.validator.js';
import { isValidTransition } from '../utils/statusTransition.js';
export const createOrder = asyncHandler(async (req, res) => {
    const validatedData = createOrderSchema.parse(req.body);
    // H3: Validate Karigar Assignment
    const karigar = await User.findOne({
        _id: validatedData.assignedTo,
        role: 'KARIGAR',
        isActive: true,
        isApproved: true
    });
    if (!karigar) {
        throw new AppError('Invalid, inactive, or unapproved Karigar assigned', 400, 'GL_400');
    }
    // H2: Order Photo Rules (1-5 images)
    const files = req.files;
    if (!files || files.length < 1 || files.length > 5) {
        throw new AppError('Order must have between 1 and 5 images', 400, 'GL_400');
    }
    const orderCode = await generateOrderCode();
    const order = new Order({
        ...validatedData,
        orderCode,
        createdBy: req.user?._id,
        status: 'PENDING',
        statusLogs: [{
                status: 'PENDING',
                updatedBy: req.user?._id,
            }]
    });
    // H10: Upload Standardization
    const uploadPromises = files.map(file => uploadToS3(file, 'orders'));
    const keys = await Promise.all(uploadPromises);
    order.images = keys.map(key => ({ key, type: 'INITIAL' }));
    await order.save();
    res.status(201).json({ success: true, data: order });
});
export const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ createdBy: req.user?._id })
        .populate('assignedTo', 'name role _id') // C3: Hide phone/email
        .sort({ createdAt: -1 });
    // Generate signed URLs
    const ordersWithUrls = await Promise.all(orders.map(async (order) => {
        const orderObj = order.toObject();
        orderObj.images = await Promise.all(order.images.map(async (img) => ({
            ...img,
            url: await getSignedS3Url(img.key)
        })));
        return orderObj;
    }));
    res.status(200).json({ success: true, count: orders.length, data: ordersWithUrls });
});
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id })
        .populate('assignedTo', 'name role _id')
        .populate('statusLogs.updatedBy', 'name role')
        .populate('materialLogs.loggedBy', 'name role');
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    const orderObj = order.toObject();
    orderObj.images = await Promise.all(order.images.map(async (img) => ({
        ...img,
        url: await getSignedS3Url(img.key)
    })));
    res.status(200).json({ success: true, data: orderObj });
});
export const updateOrder = asyncHandler(async (req, res) => {
    const validatedData = updateOrderSchema.parse(req.body);
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    if (['COMPLETED', 'RECEIVED'].includes(order.status)) {
        throw new AppError('Cannot update a completed or received order', 400, 'GL_400');
    }
    // C8: Whitelist update
    Object.assign(order, validatedData);
    await order.save();
    res.status(200).json({ success: true, data: order });
});
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = updateStatusSchema.parse(req.body);
    // C6: Staff Status Restrictions
    const allowedStatuses = ['RECEIVED', 'REVISION_REQUESTED', 'ON_HOLD'];
    if (!allowedStatuses.includes(status)) {
        throw new AppError('Staff can only set status to RECEIVED, REVISION_REQUESTED, or ON_HOLD', 403, 'GL_403');
    }
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    if (!isValidTransition(order.status, status)) {
        throw new AppError(`Invalid status transition from ${order.status} to ${status}`, 400, 'GL_400');
    }
    order.status = status;
    order.statusLogs.push({
        status,
        updatedBy: req.user?._id,
        createdAt: new Date()
    });
    await order.save();
    res.status(200).json({ success: true, data: order });
});
export const addPayment = asyncHandler(async (req, res) => {
    const { amount, type, status } = req.body;
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    order.payments.push({
        amount,
        type,
        status: status || 'PAID',
        paidAt: new Date()
    });
    if (status !== 'PENDING') {
        if (type === 'ADVANCE')
            order.advancePaid += amount;
        // We could add more logic for FINAL payments etc.
    }
    await order.save();
    res.status(201).json({ success: true, data: order.payments });
});
export const addIssuedMaterial = asyncHandler(async (req, res) => {
    const { issuedWeight } = req.body;
    if (issuedWeight < 0)
        throw new AppError('Issued weight must be positive', 400, 'GL_400');
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    order.materialLogs.push({
        issuedWeight,
        returnedWeight: 0,
        wastage: 0,
        loggedBy: req.user?._id,
        loggedAt: new Date()
    });
    await order.save();
    res.status(201).json({ success: true, data: order.materialLogs });
});
export const updateReturnedMaterial = asyncHandler(async (req, res) => {
    const { returnedWeight, logId } = req.body;
    const order = await Order.findOne({ _id: req.params.id, createdBy: req.user?._id });
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    const logIndex = logId
        ? order.materialLogs.findIndex((log) => log._id?.toString() === logId)
        : order.materialLogs.length - 1;
    if (logIndex === -1)
        throw new AppError('Material log not found', 404, 'GL_404');
    const log = order.materialLogs[logIndex];
    // H4: Wastage Fix
    if (returnedWeight < 0)
        throw new AppError('Returned weight cannot be negative', 400, 'GL_400');
    if (returnedWeight > log.issuedWeight)
        throw new AppError('Returned weight cannot exceed issued weight', 400, 'GL_400');
    log.returnedWeight = returnedWeight;
    log.wastage = log.issuedWeight - returnedWeight;
    await order.save();
    res.status(200).json({ success: true, data: log });
});
export const syncDrafts = asyncHandler(async (req, res) => {
    const { drafts } = req.body;
    if (!Array.isArray(drafts))
        throw new AppError('Drafts should be an array', 400, 'GL_400');
    const results = [];
    for (const draft of drafts) {
        try {
            const orderCode = await generateOrderCode();
            const order = await Order.create({
                ...draft,
                orderCode,
                createdBy: req.user?._id,
            });
            results.push({ success: true, orderId: order._id, tempId: draft.tempId });
        }
        catch (error) {
            results.push({ success: false, error: error.message, tempId: draft.tempId });
        }
    }
    res.status(200).json({ success: true, data: results });
});
//# sourceMappingURL=staff.controller.js.map