export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'COMPLETED' | 'RECEIVED' | 'ON_HOLD' | 'REVISION_REQUESTED';
/**
 * Explicit, role-agnostic transition table for Order.status.
 * Controllers should only allow transitions that match this table.
 */
export declare const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]>;
export declare const canTransitionOrderStatus: (from: OrderStatus, to: OrderStatus) => boolean;
export declare const assertValidOrderStatusTransition: (from: OrderStatus, to: OrderStatus) => void;
//# sourceMappingURL=orderStatusTransitions.service.d.ts.map