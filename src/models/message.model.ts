import mongoose, { Document, Schema } from 'mongoose';

export type MessageDeliveryStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface IMessage extends Document {
  orderId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  /** Intended recipient for this message (other party on the order). */
  receiverId?: mongoose.Types.ObjectId;
  messageType: 'text' | 'image' | 'video' | 'voice' | 'file';
  content?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  isDelivered: boolean;
  deliveredAt?: Date;
  isRead: boolean;
  readAt?: Date;
  /** Delivery / read pipeline for clients that key off a single enum. */
  status?: MessageDeliveryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User' },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'voice', 'file'],
      default: 'text',
    },
    content: { type: String },
    mediaUrl: { type: String },
    thumbnailUrl: { type: String },
    fileName: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    duration: { type: Number },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'READ'],
      default: 'SENT',
    },
  },
  { timestamps: true }
);

MessageSchema.index({ orderId: 1, createdAt: -1 });
MessageSchema.index({ orderId: 1, senderId: 1 });
MessageSchema.index({ orderId: 1, receiverId: 1 });
MessageSchema.index({ receiverId: 1, isRead: 1, orderId: 1 });
MessageSchema.index({ receiverId: 1, readAt: 1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
