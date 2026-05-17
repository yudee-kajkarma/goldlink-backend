/** Canonical order priority values (API + persisted preferred shape). */
export const ORDER_PRIORITIES = ['NORMAL', 'URGENT', 'EXPRESS'] as const;
export type OrderPriority = (typeof ORDER_PRIORITIES)[number];

/** Legacy values that may still exist in MongoDB from older builds. */
export const LEGACY_ORDER_PRIORITIES = ['HIGH', 'LOW'] as const;
