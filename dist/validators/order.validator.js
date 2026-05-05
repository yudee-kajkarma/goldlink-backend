import { z } from 'zod';
export const createOrderSchema = z.object({
    jewelleryType: z.enum(["Ring", "Necklace", "Bangle", "Earring", "Pendant"]),
    metalType: z.enum(["Gold", "Silver", "Platinum", "Rose Gold"]),
    weight: z.number().positive().optional(),
    purity: z.string().optional(),
    priority: z.enum(["NORMAL", "URGENT", "EXPRESS"]).optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    customerRef: z.string().optional(),
    designNotes: z.string().optional(),
    assignedTo: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Karigar ID"),
    totalAmount: z.number().nonnegative().optional(),
    advancePaid: z.number().nonnegative().optional(),
});
export const updateOrderSchema = z.object({
    weight: z.number().positive().optional(),
    designNotes: z.string().optional(),
    purity: z.string().optional(),
    priority: z.enum(["NORMAL", "URGENT", "EXPRESS"]).optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    customerRef: z.string().optional(),
    jewelleryType: z.enum(["Ring", "Necklace", "Bangle", "Earring", "Pendant"]).optional(),
    metalType: z.enum(["Gold", "Silver", "Platinum", "Rose Gold"]).optional(),
    totalAmount: z.number().nonnegative().optional(),
    advancePaid: z.number().nonnegative().optional(),
});
export const updateStatusSchema = z.object({
    status: z.enum([
        "PENDING",
        "ACCEPTED",
        "IN_PROGRESS",
        "QUALITY_CHECK",
        "COMPLETED",
        "RECEIVED",
        "ON_HOLD",
        "REVISION_REQUESTED",
    ]),
    completionNote: z.string().optional(),
});
//# sourceMappingURL=order.validator.js.map