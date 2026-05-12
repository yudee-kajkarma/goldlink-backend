import { resolveStoredChatMediaUrl } from '../services/s3.service.js';

export type ChatOrderParticipants = { createdById: string; assignedToId: string };

/** Normalizes REST + socket payloads so mobile/web can map one shape (`text`, `status`, `receiverId`, …). */
export function enrichChatMessageForClient(
  plain: Record<string, unknown>,
  participants: ChatOrderParticipants
): Record<string, unknown> {
  const id = String(plain._id ?? plain.id ?? '');
  const senderId = String(plain.senderId ?? '');
  const { createdById, assignedToId } = participants;
  const receiverIdFromDoc = plain.receiverId != null ? String(plain.receiverId) : '';
  const receiverIdComputed = senderId === createdById ? assignedToId : createdById;
  const receiverId = receiverIdFromDoc || receiverIdComputed;

  let status: 'sent' | 'delivered' | 'read' = 'sent';
  if (plain.isRead === true) status = 'read';
  else if (plain.isDelivered === true) status = 'delivered';

  const content = plain.content != null ? String(plain.content) : '';
  const messageType = (plain.messageType ?? 'text') as string;
  const rawMedia = plain.mediaUrl != null ? String(plain.mediaUrl) : undefined;
  const mediaUrlResolved = resolveStoredChatMediaUrl(rawMedia) ?? rawMedia;

  const orderIdStr = String(plain.orderId ?? '');

  return {
    ...plain,
    id,
    _id: id,
    chatId: orderIdStr,
    orderId: orderIdStr,
    senderId,
    receiverId,
    type: messageType,
    text: content,
    content,
    messageType,
    status,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    delivered: plain.isDelivered === true,
    read: plain.isRead === true,
    isDelivered: plain.isDelivered ?? false,
    isRead: plain.isRead ?? false,
    deliveredAt: plain.deliveredAt,
    readAt: plain.readAt,
    mediaUrl: mediaUrlResolved,
    mediaKey: rawMedia && !/^https?:\/\//i.test(rawMedia) ? rawMedia : undefined,
    thumbnailUrl: plain.thumbnailUrl,
    fileName: plain.fileName,
    mimeType: plain.mimeType,
    fileSize: plain.fileSize,
    duration: plain.duration,
  };
}
