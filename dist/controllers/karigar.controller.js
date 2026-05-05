import { asyncHandler } from '../utils/asyncHandler.js';
import { Order } from '../models/order.model.js';
import { AppError } from '../utils/AppError.js';
import { uploadToS3, getSignedS3Url } from '../services/s3.service.js';
import { isValidTransition } from '../utils/statusTransition.js';
import { updateStatusSchema } from '../validators/order.validator.js';
export const getAssignedOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ assignedTo: req.user?._id })
        .populate('createdBy', 'name role _id') // C3: Hide phone/email
        .sort({ createdAt: -1 });
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
    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id })
        .populate('createdBy', 'name role _id')
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
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, completionNote } = updateStatusSchema.parse(req.body);
    const order = await Order.findOne({ _id: req.params.id, assignedTo: req.user?._id });
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    // Karigar allowed statuses
    const allowedStatuses = ['ACCEPTED', 'IN_PROGRESS', 'QUALITY_CHECK', 'COMPLETED', 'ON_HOLD'];
    if (!allowedStatuses.includes(status)) {
        throw new AppError('Karigar is not authorized to set this status', 403, 'GL_403');
    }
    if (!isValidTransition(order.status, status)) {
        throw new AppError(`Invalid status transition from ${order.status} to ${status}`, 400, 'GL_400');
    }
    // C7: Karigar Completion Upload Security - Check if images are present if status is COMPLETED
    if (status === 'COMPLETED') {
        const completionImages = order.images.filter(img => img.type === 'COMPLETION');
        if (completionImages.length === 0) {
            throw new AppError('At least one completion image must be uploaded before marking as COMPLETED', 400, 'GL_400');
        }
    }
    order.status = status;
    if (completionNote)
        order.completionNote = completionNote;
    order.statusLogs.push({
        status,
        updatedBy: req.user?._id,
        createdAt: new Date()
    });
    await order.save();
    res.status(200).json({ success: true, data: order });
});
// C7: Karigar Completion Images Upload
export const uploadCompletionImages = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    const files = req.files;
    if (!orderId)
        throw new AppError('orderId is required', 400, 'GL_400');
    if (!files || files.length === 0)
        throw new AppError('No images uploaded', 400, 'GL_400');
    const order = await Order.findOne({ _id: orderId, assignedTo: req.user?._id });
    if (!order)
        throw new AppError('Order not found or not assigned to you', 404, 'GL_404');
    const uploadPromises = files.map(file => uploadToS3(file, 'completions'));
    const keys = await Promise.all(uploadPromises);
    const completionImages = keys.map(key => ({ key, type: 'COMPLETION' }));
    order.images.push(...completionImages);
    await order.save();
    res.status(200).json({ success: true, message: 'Completion images uploaded successfully', data: order.images });
});
//# sourceMappingURL=karigar.controller.js.map