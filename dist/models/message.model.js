import mongoose, { Document, Schema } from 'mongoose';
const MessageSchema = new Schema({
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'voice'],
        required: true,
    },
    content: { type: String },
    mediaUrl: { type: String },
    duration: { type: Number },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
}, { timestamps: true });
export const Message = mongoose.model('Message', MessageSchema);
//# sourceMappingURL=message.model.js.map