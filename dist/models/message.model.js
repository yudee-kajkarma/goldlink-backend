import mongoose, { Schema } from 'mongoose';
const MessageSchema = new Schema({
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'voice'],
        required: true,
    },
    content: { type: String },
    mediaKey: { type: String },
    mediaUrl: { type: String },
    duration: { type: Number },
    isSent: { type: Boolean, default: true },
    isDelivered: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    readAt: { type: Date },
}, { timestamps: true });
MessageSchema.index({ orderId: 1, createdAt: -1 });
export const Message = mongoose.model('Message', MessageSchema);
export default Message;
//# sourceMappingURL=message.model.js.map