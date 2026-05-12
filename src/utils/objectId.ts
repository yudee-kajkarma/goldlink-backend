/** Strict 24-char hex ObjectId check (avoids Mongoose accepting ambiguous strings). */
export function isMongoObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}
