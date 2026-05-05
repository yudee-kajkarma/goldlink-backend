import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, z.core.$strip>;
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
    role: z.ZodEnum<{
        STAFF: "STAFF";
        KARIGAR: "KARIGAR";
    }>;
}, z.core.$strip>;
export declare const createUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
    role: z.ZodEnum<{
        ADMIN: "ADMIN";
        STAFF: "STAFF";
        KARIGAR: "KARIGAR";
    }>;
    isApproved: z.ZodOptional<z.ZodBoolean>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const updateLanguageSchema: z.ZodObject<{
    language: z.ZodEnum<{
        en: "en";
        hi: "hi";
    }>;
}, z.core.$strip>;
