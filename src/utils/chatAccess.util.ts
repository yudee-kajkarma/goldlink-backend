/**
 * Order chat has exactly two participants: the creator (staff or admin) and
 * the assigned karigar. Anyone else — including admins browsing other
 * people's orders — is a read-only observer.
 */

function refToId(ref: unknown): string {
  if (ref == null) return '';
  if (typeof ref === 'object' && '_id' in (ref as Record<string, unknown>)) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

export function isOrderChatParticipant(
  order: { createdBy: unknown; assignedTo: unknown },
  userId: string | undefined
): boolean {
  if (!userId) return false;
  return userId === refToId(order.createdBy) || userId === refToId(order.assignedTo);
}
