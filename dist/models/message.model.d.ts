import mongoose, { Document } from 'mongoose';
export interface IMessage extends Document {
    orderId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    messageType: 'text' | 'image' | 'video' | 'voice';
    content?: string;
    mediaUrl?: string;
    duration?: number;
    isDelivered: boolean;
    deliveredAt?: Date;
    isRead: boolean;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Message: mongoose.Model<IMessage, {}, {}, {}, mongoose.Document<unknown, {}, IMessage, {}, {}> & IMessage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=message.model.d.ts.map