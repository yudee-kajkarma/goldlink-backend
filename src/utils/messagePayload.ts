/** Socket.IO and JSON responses should use plain objects (consistent fields; avoids BSON quirks). */
export function messageToPlain(msg: unknown): Record<string, unknown> {
  if (
    msg &&
    typeof msg === 'object' &&
    'toJSON' in msg &&
    typeof (msg as { toJSON: unknown }).toJSON === 'function'
  ) {
    return (msg as { toJSON: () => Record<string, unknown> }).toJSON();
  }
  return (msg ?? {}) as Record<string, unknown>;
}
