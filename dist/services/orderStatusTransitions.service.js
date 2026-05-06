/**
 * Explicit, role-agnostic transition table for Order.status.
 * Controllers should only allow transitions that match this table.
 */
export const ORDER_STATUS_TRANSITIONS = {
    PENDING: ['ACCEPTED'],
    ACCEPTED: ['IN_PROGRESS', 'ON_HOLD'],
    IN_PROGRESS: ['QUALITY_CHECK', 'ON_HOLD'],
    QUALITY_CHECK: ['COMPLETED', 'ON_HOLD', 'REVISION_REQUESTED'],
    REVISION_REQUESTED: ['IN_PROGRESS', 'ON_HOLD'],
    COMPLETED: ['RECEIVED'],
    RECEIVED: [],
    ON_HOLD: ['IN_PROGRESS', 'QUALITY_CHECK', 'REVISION_REQUESTED'],
};
export const canTransitionOrderStatus = (from, to) => {
    return ORDER_STATUS_TRANSITIONS[from].includes(to);
};
export const assertValidOrderStatusTransition = (from, to) => {
    if (!canTransitionOrderStatus(from, to)) {
        throw new Error(`Invalid order status transition: ${from} -> ${to}`);
    }
};
//# sourceMappingURL=orderStatusTransitions.service.js.map