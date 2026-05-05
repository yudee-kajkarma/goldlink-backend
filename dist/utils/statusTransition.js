export const statusTransitions = {
    PENDING: ["ACCEPTED", "ON_HOLD"],
    ACCEPTED: ["IN_PROGRESS", "ON_HOLD"],
    IN_PROGRESS: ["QUALITY_CHECK", "ON_HOLD"],
    QUALITY_CHECK: ["COMPLETED", "REVISION_REQUESTED", "ON_HOLD"],
    COMPLETED: ["RECEIVED", "ON_HOLD"],
    REVISION_REQUESTED: ["IN_PROGRESS", "ON_HOLD"],
    ON_HOLD: ["PENDING", "ACCEPTED", "IN_PROGRESS", "QUALITY_CHECK", "COMPLETED", "REVISION_REQUESTED"],
    RECEIVED: [], // Terminal state
};
export const isValidTransition = (current, next) => {
    // Staff can move ANY status to ON_HOLD or REVISION_REQUESTED or RECEIVED (with validation)
    // But let's stick to the map for strict flow
    return statusTransitions[current].includes(next);
};
//# sourceMappingURL=statusTransition.js.map