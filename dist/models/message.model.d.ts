import mongoose, { Document } from 'mongoose';
export interface IMessage extends Document {
    orderId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    messageType: 'text' | 'image' | 'video' | 'voice';
    content?: string;
    mediaKey?: string;
    mediaUrl?: string;
    isFlagged?: boolean;
    duration?: number;
    isSent: boolean;
    isDelivered: boolean;
    isRead: boolean;
    deliveredAt?: Date;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Message: mongoose.Model<IMessage, {}, {}, {}, mongoose.Document<unknown, {}, IMessage, {}, {}> & IMessage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Message;
