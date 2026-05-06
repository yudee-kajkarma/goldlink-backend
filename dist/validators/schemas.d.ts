import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
    role: z.ZodEnum<{
        STAFF: "STAFF";
        KARIGAR: "KARIGAR";
    }>;
    department: z.ZodOptional<z.ZodString>;
    designation: z.ZodOptional<z.ZodString>;
    skillType: z.ZodOptional<z.ZodString>;
    experienceYears: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, z.core.$strip>;
export declare const fcmTokenSchema: z.ZodObject<{
    fcmToken: z.ZodString;
}, z.core.$strip>;
export declare const updateLanguageSchema: z.ZodObject<{
    language: z.ZodPreprocess<z.ZodEnum<{
        EN: "EN";
        HI: "HI";
    }>>;
}, z.core.$strip>;
export declare const adminCreateUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
    role: z.ZodEnum<{
        STAFF: "STAFF";
        KARIGAR: "KARIGAR";
    }>;
    department: z.ZodOptional<z.ZodString>;
    designation: z.ZodOptional<z.ZodString>;
    skillType: z.ZodOptional<z.ZodString>;
    experienceYears: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const reassignOrderSchema: z.ZodObject<{
    karigarId: z.ZodString;
}, z.core.$strip>;
export declare const createOrderBodySchema: z.ZodObject<{
    assignedTo: z.ZodString;
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
    weight: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    designNotes: z.ZodOptional<z.ZodString>;
    purity: z.ZodOptional<z.ZodString>;
    expectedDeliveryDate: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    priority: z.ZodOptional<z.ZodEnum<{
        NORMAL: "NORMAL";
        URGENT: "URGENT";
        EXPRESS: "EXPRESS";
    }>>;
    customerRef: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const staffOrderStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        RECEIVED: "RECEIVED";
        ON_HOLD: "ON_HOLD";
        REVISION_REQUESTED: "REVISION_REQUESTED";
    }>;
}, z.core.$strip>;
export declare const addPaymentSchema: z.ZodObject<{
    amount: z.ZodCoercedNumber<unknown>;
    type: z.ZodEnum<{
        ADVANCE: "ADVANCE";
        FINAL: "FINAL";
    }>;
    status: z.ZodOptional<z.ZodEnum<{
        PENDING: "PENDING";
        PAID: "PAID";
    }>>;
}, z.core.$strip>;
export declare const addIssuedMaterialSchema: z.ZodObject<{
    issuedWeight: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
export declare const updateReturnedMaterialSchema: z.ZodObject<{
    returnedWeight: z.ZodCoercedNumber<unknown>;
    logId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const karigarOrderStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        IN_PROGRESS: "IN_PROGRESS";
        QUALITY_CHECK: "QUALITY_CHECK";
        ON_HOLD: "ON_HOLD";
    }>;
}, z.core.$strip>;
export declare const completeOrderSchema: z.ZodObject<{
    images: z.ZodArray<z.ZodString>;
    completionNote: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const sendMessageSchema: z.ZodObject<{
    orderId: z.ZodString;
    content: z.ZodOptional<z.ZodString>;
    messageType: z.ZodOptional<z.ZodEnum<{
        text: "text";
        image: "image";
        video: "video";
        voice: "voice";
    }>>;
    mediaUrl: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const chatUploadBodySchema: z.ZodObject<{
    orderId: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=schemas.d.ts.map