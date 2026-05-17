/** Path segments that must not be routed as GET /api/chat/:orderId (reserved words). */
export const RESERVED_CHAT_PATH_SEGMENTS = new Set(
  [
    'rooms',
    'messages',
    'upload',
    'send-image',
    'send-video',
    'send-voice',
    'read',
    'unread',
    'orders',
  ].map((s) => s.toLowerCase())
);

export function isReservedChatPathSegment(segment: string): boolean {
  return RESERVED_CHAT_PATH_SEGMENTS.has(segment.trim().toLowerCase());
}
