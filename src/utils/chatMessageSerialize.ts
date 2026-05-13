import { resolveStoredChatMediaUrl } from '../services/s3.service.js';
import {
  chatSenderDeleted,
  chatSenderFromUserDoc,
  type ChatSenderPublic,
} from './chatSender.util.js';

export type ChatOrderParticipants = { createdById: string; assignedToId: string };

export type EnrichChatMessageOptions = {
  /** When the emitter knows the sender (e.g. socket.session user), avoids ambiguous payloads without populate. */
  senderOverride?: ChatSenderPublic | null;
};

function extractSenderIdString(plain: Record<string, unknown>): string {
  const sid = plain.senderId;
  if (sid != null && typeof sid === 'object' && '_id' in sid) {
    const inner = (sid as { _id: unknown })._id;
    return inner != null ? String(inner) : '';
  }
  return sid != null ? String(sid) : '';
}

function resolveSenderForPayload(
  plain: Record<string, unknown>,
  options?: EnrichChatMessageOptions
): ChatSenderPublic {
  if (options?.senderOverride) return options.senderOverride;

  const sid = plain.senderId;
  if (sid != null && typeof sid === 'object' && '_id' in sid) {
    const fromDoc = chatSenderFromUserDoc(sid as Record<string, unknown>);
    return fromDoc ?? chatSenderDeleted();
  }

  if (sid === null || sid === undefined) {
    return chatSenderDeleted();
  }

  return {
    _id: extractSenderIdString(plain) || null,
    fullName: 'Unknown User',
    role: 'unknown',
  };
}

/** Normalizes REST + socket payloads so mobile/web can map one shape (`text`, `status`, `receiverId`, …). */
export function enrichChatMessageForClient(
  plain: Record<string, unknown>,
  participants: ChatOrderParticipants,
  options?: EnrichChatMessageOptions
): Record<string, unknown> {
  const id = String(plain._id ?? plain.id ?? '');
  const senderId = extractSenderIdString(plain);
  const sender = resolveSenderForPayload(plain, options);
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
    sender,
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
