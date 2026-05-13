/** Fields to populate / select when hydrating chat senders (extra keys are harmless if absent from schema). */
export const CHAT_SENDER_POPULATE_SELECT =
  '_id firstName lastName fullName name role userRole accountRole' as const;

export type ChatSenderPublic = {
  _id: string | null;
  fullName: string;
  role: 'admin' | 'staff' | 'karigar' | 'unknown';
};

export function normalizeChatRole(raw: unknown): ChatSenderPublic['role'] {
  if (raw == null) return 'unknown';
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');

  const aliases: Record<string, ChatSenderPublic['role']> = {
    admin: 'admin',
    administrator: 'admin',
    staff: 'staff',
    employee: 'staff',
    office_staff: 'staff',
    karigar: 'karigar',
    worker: 'karigar',
    artisan: 'karigar',
    craftsman: 'karigar',
    unknown: 'unknown',
  };

  return aliases[s] ?? 'unknown';
}

export function resolveChatFullName(doc: Record<string, unknown>): string {
  const full =
    (typeof doc.fullName === 'string' && doc.fullName.trim()) ||
    (typeof doc.name === 'string' && doc.name.trim()) ||
    '';
  if (full.length > 0) return full;
  const first = typeof doc.firstName === 'string' ? doc.firstName : '';
  const last = typeof doc.lastName === 'string' ? doc.lastName : '';
  const combined = `${first} ${last}`.trim();
  return combined.length > 0 ? combined : 'Unknown User';
}

/** Build public sender from a populated User doc (lean object). */
export function chatSenderFromUserDoc(doc: Record<string, unknown> | null | undefined): ChatSenderPublic | null {
  if (!doc || typeof doc !== 'object') return null;
  const id = doc._id != null ? String(doc._id) : null;
  const roleRaw = doc.role ?? doc.userRole ?? doc.accountRole;
  return {
    _id: id,
    fullName: resolveChatFullName(doc),
    role: normalizeChatRole(roleRaw),
  };
}

export function chatSenderDeleted(): ChatSenderPublic {
  return { _id: null, fullName: 'Unknown User', role: 'unknown' };
}

/** Hydrated mongoose user / socket attachment — any subset of name fields. */
export function chatSenderFromUserLike(u: {
  _id?: unknown;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  role?: unknown;
  userRole?: unknown;
  accountRole?: unknown;
}): ChatSenderPublic {
  const doc = u as Record<string, unknown>;
  const built = chatSenderFromUserDoc(doc);
  return built ?? chatSenderDeleted();
}
