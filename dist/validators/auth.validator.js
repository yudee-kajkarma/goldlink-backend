import { z } from 'zod';
export const loginSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().min(10).max(15).optional(),
    password: z.string().min(8),
}).refine(data => data.email || data.phone, {
    message: "Either email or phone must be provided",
    path: ["email", "phone"]
});
const baseUserSchema = z.object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    phone: z.string().min(10).max(15).optional(),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    }),
});
export const registerSchema = baseUserSchema.extend({
    role: z.enum(['STAFF', 'KARIGAR']),
}).refine(data => data.email || data.phone, {
    message: "Either email or phone must be provided",
    path: ["email", "phone"]
});
export const createUserSchema = baseUserSchema.extend({
    role: z.enum(['ADMIN', 'STAFF', 'KARIGAR']),
    isApproved: z.boolean().optional(),
    isActive: z.boolean().optional(),
}).refine(data => data.email || data.phone, {
    message: "Either email or phone must be provided",
    path: ["email", "phone"]
});
export const updateLanguageSchema = z.object({
    language: z.enum(['en', 'hi']),
});
//# sourceMappingURL=auth.validator.js.map