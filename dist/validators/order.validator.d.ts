import { z } from 'zod';
export declare const createOrderSchema: z.ZodObject<{
    jewelleryType: z.ZodEnum<{
        Ring: "Ring";
        Necklace: "Necklace";
        Bangle: "Bangle";
        Earring: "Earring";
        Pendant: "Pendant";
    }>;
    metalType: z.ZodEnum<{
        Gold: "Gold";
        Silver: "Silver";
        Platinum: "Platinum";
        "Rose Gold": "Rose Gold";
    }>;
    weight: z.ZodOptional<z.ZodNumber>;
    purity: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<{
        NORMAL: "NORMAL";
        URGENT: "URGENT";
        EXPRESS: "EXPRESS";
    }>>;
    expectedDeliveryDate: z.ZodOptional<z.ZodString>;
    customerRef: z.ZodOptional<z.ZodString>;
    designNotes: z.ZodOptional<z.ZodString>;
    assignedTo: z.ZodString;
    totalAmount: z.ZodOptional<z.ZodNumber>;
    advancePaid: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateOrderSchema: z.ZodObject<{
    weight: z.ZodOptional<z.ZodNumber>;
    designNotes: z.ZodOptional<z.ZodString>;
    purity: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<{
        NORMAL: "NORMAL";
        URGENT: "URGENT";
        EXPRESS: "EXPRESS";
    }>>;
    expectedDeliveryDate: z.ZodOptional<z.ZodString>;
    customerRef: z.ZodOptional<z.ZodString>;
    jewelleryType: z.ZodOptional<z.ZodEnum<{
        Ring: "Ring";
        Necklace: "Necklace";
        Bangle: "Bangle";
        Earring: "Earring";
        Pendant: "Pendant";
    }>>;
    metalType: z.ZodOptional<z.ZodEnum<{
        Gold: "Gold";
        Silver: "Silver";
        Platinum: "Platinum";
        "Rose Gold": "Rose Gold";
    }>>;
    totalAmount: z.ZodOptional<z.ZodNumber>;
    advancePaid: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        PENDING: "PENDING";
        ACCEPTED: "ACCEPTED";
        IN_PROGRESS: "IN_PROGRESS";
        QUALITY_CHECK: "QUALITY_CHECK";
        COMPLETED: "COMPLETED";
        RECEIVED: "RECEIVED";
        ON_HOLD: "ON_HOLD";
        REVISION_REQUESTED: "REVISION_REQUESTED";
    }>;
    completionNote: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
