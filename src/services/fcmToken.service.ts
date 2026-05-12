import User from '../models/user.model.js';

const MAX_DEVICE_TOKENS = 15;

/** Merge legacy single `fcmToken` with `fcmTokens`, dedupe and cap length. */
export async function registerFcmTokenForUser(userId: string, token: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }

  const trimmed = token.trim();

  const fromArray = [...(user.fcmTokens ?? [])];
  const legacy = user.fcmToken;
  const merged = [trimmed, ...(legacy && legacy !== trimmed ? [legacy] : []), ...fromArray.filter((t) => t && t !== trimmed)];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of merged) {
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    unique.push(t);
    if (unique.length >= MAX_DEVICE_TOKENS) {
      break;
    }
  }

  user.fcmToken = trimmed;
  user.fcmTokens = unique;
  await user.save();
}
