import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import * as callService from '../services/call.service.js';
import { User } from '../models/user.model.js';
import { Order } from '../models/order.model.js';
import twilio from 'twilio';
export const initiateCall = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    if (!orderId)
        throw new AppError('orderId is required', 400, 'GL_400');
    const order = await Order.findById(orderId).populate('createdBy assignedTo');
    if (!order)
        throw new AppError('Order not found', 404, 'GL_404');
    // Verify requester is part of order
    const userId = req.user?._id.toString();
    const staffId = order.createdBy._id.toString();
    const karigarId = order.assignedTo._id.toString();
    if (userId !== staffId && userId !== karigarId) {
        throw new AppError('You are not authorized to call for this order', 403, 'GL_403');
    }
    const fromUser = await User.findById(userId).select('+phone');
    const targetUser = userId === staffId ? order.assignedTo : order.createdBy;
    const targetUserWithPhone = await User.findById(targetUser._id).select('+phone');
    if (!fromUser?.phone || !targetUserWithPhone?.phone) {
        throw new AppError('Phone number not found for one or both parties', 400, 'GL_400');
    }
    const callSid = await callService.initiateMaskedCall(fromUser.phone, targetUserWithPhone.phone, orderId);
    res.status(200).json({ success: true, message: 'Call initiated', callSid });
});
export const callBridge = (req, res) => {
    const { to } = req.query;
    const twiml = new twilio.twiml.VoiceResponse();
    if (to) {
        twiml.dial({ record: 'record-from-answer' }, to.toString());
    }
    else {
        twiml.say('Invalid request. Goodbye.');
    }
    res.type('text/xml');
    res.send(twiml.toString());
};
export const getAdminCalls = asyncHandler(async (req, res) => {
    // Logic to list call logs from DB (need a Call model)
    res.status(200).json({ success: true, data: [] });
});
//# sourceMappingURL=call.controller.js.map