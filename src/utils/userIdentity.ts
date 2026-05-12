/** Canonical email for lookups & storage (Mongo unique index is case-sensitive). */
export function normalizeEmail(email: string | undefined): string | undefined {
  if (email == null || typeof email !== 'string') return undefined;
  const t = email.trim().toLowerCase();
  return t.length > 0 ? t : undefined;
}

/** Canonical phone for lookups & storage. */
export function normalizePhone(phone: string | undefined): string | undefined {
  if (phone == null || typeof phone !== 'string') return undefined;
  const t = phone.trim().replace(/\s+/g, '');
  return t.length > 0 ? t : undefined;
}
