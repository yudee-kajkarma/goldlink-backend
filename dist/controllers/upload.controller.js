import { s3Service } from '../services/s3.service.js';
import Order from '../models/order.model.js';
export const uploadOrderImages = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const files = req.files;
        if (!files || files.length === 0) {
            res.status(400).json({ success: false, message: 'No images provided', errorCode: 'GL_VAL_002' });
            return;
        }
        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
            return;
        }
        const userId = req.user?._id.toString();
        const canAccess = userId === order.createdBy.toString() || userId === order.assignedTo.toString();
        if (!canAccess) {
            res.status(403).json({ success: false, message: 'Unauthorized access to this order', errorCode: 'GL_AUTH_001' });
            return;
        }
        const uploadPromises = files.map(file => s3Service.uploadFile(file.buffer, file.mimetype, 'orders', orderId));
        const keys = await Promise.all(uploadPromises);
        // Save keys to DB
        await Order.findByIdAndUpdate(orderId, {
            $push: {
                images: {
                    $each: keys.map(key => ({ url: key, type: 'INITIAL' }))
                }
            }
        });
        res.status(200).json({ success: true, urls: keys });
    }
    catch (_error) {
        console.error(_error);
        res.status(500).json({ success: false, message: 'Failed to upload order images', errorCode: 'GL_SRV_001' });
    }
};
export const uploadChatMedia = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const file = req.file;
        if (!file) {
            res.status(400).json({ success: false, message: 'No media file provided', errorCode: 'GL_VAL_002' });
            return;
        }
        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found', errorCode: 'GL_NOT_FOUND_002' });
            return;
        }
        const userId = req.user?._id.toString();
        const canAccess = userId === order.createdBy.toString() || userId === order.assignedTo.toString();
        if (!canAccess) {
            res.status(403).json({ success: false, message: 'Unauthorized access to this order', errorCode: 'GL_AUTH_001' });
            return;
        }
        let subFolder = 'images';
        let mediaType = 'image';
        if (file.mimetype.startsWith('video/')) {
            subFolder = 'videos';
            mediaType = 'video';
        }
        else if (file.mimetype.startsWith('audio/')) {
            subFolder = 'voice';
            mediaType = 'voice';
        }
        const key = await s3Service.uploadFile(file.buffer, file.mimetype, 'chat', orderId, subFolder);
        // The chat message save with the key will happen separately via chat API or sockets.
        // Here we just return the uploaded file key and type so the frontend can use it.
        res.status(200).json({ success: true, mediaUrl: key, mediaType });
    }
    catch (_error) {
        console.error(_error);
        res.status(500).json({ success: false, message: 'Failed to upload chat media', errorCode: 'GL_SRV_001' });
    }
};
export const getSecureMediaUrl = async (req, res) => {
    try {
        const key = req.params[0]; // Matches the RegExp capture group
        if (!key) {
            res.status(400).json({ success: false, message: 'Media key not provided', errorCode: 'GL_VAL_002' });
            return;
        }
        const url = await s3Service.getPresignedUrl(key);
        res.status(200).json({ success: true, url });
    }
    catch (_error) {
        console.error(_error);
        res.status(500).json({ success: false, message: 'Failed to get secure media URL', errorCode: 'GL_SRV_001' });
    }
};
//# sourceMappingURL=upload.controller.js.map