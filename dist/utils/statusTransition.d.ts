export type OrderStatus = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "QUALITY_CHECK" | "COMPLETED" | "RECEIVED" | "ON_HOLD" | "REVISION_REQUESTED";
export declare const statusTransitions: Record<OrderStatus, OrderStatus[]>;
export declare const isValidTransition: (current: OrderStatus, next: OrderStatus) => boolean;
