import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  orderId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  /** Intended recipient for this message (other party on the order). */
  receiverId?: mongoose.Types.ObjectId;
  messageType: 'text' | 'image' | 'video' | 'voice';
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
      enum: ['text', 'image', 'video', 'voice'],
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
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
