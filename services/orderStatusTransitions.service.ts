export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'QUALITY_CHECK'
  | 'COMPLETED'
  | 'RECEIVED'
  | 'ON_HOLD'
  | 'REVISION_REQUESTED';

/**
 * Explicit, role-agnostic transition table for Order.status.
 * Controllers should only allow transitions that match this table.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['ACCEPTED'],
  ACCEPTED: ['IN_PROGRESS', 'ON_HOLD'],
  IN_PROGRESS: ['QUALITY_CHECK', 'ON_HOLD'],
  QUALITY_CHECK: ['COMPLETED', 'ON_HOLD', 'REVISION_REQUESTED'],
  REVISION_REQUESTED: ['IN_PROGRESS', 'ON_HOLD'],
  COMPLETED: ['RECEIVED'],
  RECEIVED: [],
  ON_HOLD: ['IN_PROGRESS', 'QUALITY_CHECK', 'REVISION_REQUESTED'],
} as const;

export const canTransitionOrderStatus = (from: OrderStatus, to: OrderStatus): boolean => {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
};

export const assertValidOrderStatusTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!canTransitionOrderStatus(from, to)) {
    throw new Error(`Invalid order status transition: ${from} -> ${to}`);
  }
};

