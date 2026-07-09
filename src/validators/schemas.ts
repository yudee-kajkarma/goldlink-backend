import { z } from 'zod';
import { ORDER_PRIORITIES } from '../constants/order.constants.js';
import { MAX_VOICE_DURATION_SECONDS } from '../constants/media.constants.js';
import { objectIdSchema } from './objectId.schema.js';

const priorityInputSchema = z.preprocess(
  (v) => (v === 'HIGH' ? 'URGENT' : v === 'LOW' ? 'NORMAL' : v),
  z.enum(ORDER_PRIORITIES).optional()
);

export const registerSchema = z
  .object({
    name: z.string().min(1),
    email: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.string().email().optional()
    ),
    phone: z.preprocess((v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, '') : v), z.string().min(1).optional()),
    password: z.string().min(8),
    role: z.enum(['STAFF', 'KARIGAR']),
    department: z.string().optional(),
    designation: z.string().optional(),
    skillType: z.string().optional(),
    experienceYears: z.coerce.number().optional(),
  })
  .refine((d) => Boolean(d.email) || Boolean(d.phone), { message: 'email or phone is required' });

export const loginSchema = z
  .object({
    email: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.string().email().optional()
    ),
    phone: z.preprocess((v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, '') : v), z.string().min(1).optional()),
    password: z.string().min(1),
    /** Send from staff/karigar/admin screens so the correct account is resolved when identities overlap in data entry. */
    role: z.enum(['ADMIN', 'STAFF', 'KARIGAR']).optional(),
  })
  .refine((d) => Boolean(d.email) || Boolean(d.phone), { message: 'email or phone is required' });

export const fcmTokenSchema = z
  .object({
    fcmToken: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.fcmToken ?? d.token), { message: 'fcmToken or token is required' });

export const registerPushTokenSchema = z
  .object({
    token: z.string().min(1).optional(),
    fcmToken: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.token ?? d.fcmToken), { message: 'token is required (or fcmToken)' });

export const updateLanguageSchema = z.object({
  language: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.enum(['EN', 'HI'])
  ),
});

export const adminCreateUserSchema = z
  .object({
    name: z.string().min(1),
    email: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.string().email().optional()
    ),
    phone: z.preprocess((v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, '') : v), z.string().min(1).optional()),
    password: z.string().min(8),
    role: z.enum(['STAFF', 'KARIGAR']),
    department: z.string().optional(),
    designation: z.string().optional(),
    skillType: z.string().optional(),
    experienceYears: z.coerce.number().optional(),
  })
  .refine((d) => Boolean(d.email) || Boolean(d.phone), { message: 'email or phone is required' });

export const reassignOrderSchema = z.object({
  karigarId: objectIdSchema,
});

const jewelleryTypes = ['Ring', 'Necklace', 'Bangle', 'Earring', 'Pendant'] as const;
const metalTypes = ['Gold', 'Silver', 'Platinum', 'Rose Gold'] as const;

export const createOrderBodySchema = z.object({
  assignedTo: objectIdSchema,
  jewelleryType: z.enum(jewelleryTypes),
  metalType: z.enum(metalTypes),
  weight: z.coerce.number().optional(),
  designNotes: z.string().optional(),
  purity: z.string().optional(),
  expectedDeliveryDate: z.coerce.date().optional(),
  priority: priorityInputSchema,
  customerRef: z.string().optional(),
  // MONEY-DISABLED: totalAmount: z.coerce.number().nonnegative().optional(),
});

export const staffOrderStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'REVISION_REQUESTED', 'ON_HOLD']),
});

// MONEY-DISABLED: addPayment validation
// export const addPaymentSchema = z.object({
//   amount: z.coerce.number().nonnegative(),
//   type: z.enum(['ADVANCE', 'FINAL']),
//   status: z.enum(['PAID', 'PENDING']).optional(),
// });

export const addIssuedMaterialSchema = z.object({
  issuedWeight: z.coerce.number().nonnegative(),
});

export const updateReturnedMaterialSchema = z.object({
  returnedWeight: z.coerce.number().nonnegative(),
  logId: z.string().optional(),
});

export const karigarOrderStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'QUALITY_CHECK', 'ON_HOLD']),
});

export const completeOrderSchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  completionNote: z.string().optional(),
});

export const sendMessageSchema = z
  .object({
    orderId: objectIdSchema,
    content: z.string().optional(),
    messageType: z.enum(['text', 'image', 'video', 'voice', 'file']).optional(),
    mediaUrl: z.string().optional(),
    duration: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const mt = data.messageType ?? 'text';
    if (mt === 'text' && (!data.content || data.content.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'content is required for text messages' });
    }
    if (['image', 'video', 'voice', 'file'].includes(mt) && !data.mediaUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `mediaUrl is required for ${mt} messages` });
    }
    if (mt === 'voice') {
      if (data.duration == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duration is required for voice messages' });
      } else if (data.duration > MAX_VOICE_DURATION_SECONDS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `voice note duration must be at most ${MAX_VOICE_DURATION_SECONDS} seconds`,
        });
      }
    }
  });

export const chatUploadBodySchema = z.object({
  orderId: objectIdSchema,
});

export const sendChatImageBodySchema = z
  .object({
    orderId: objectIdSchema.optional(),
    chatId: objectIdSchema.optional(),
  })
  .refine((d) => Boolean(d.orderId ?? d.chatId), { message: 'orderId or chatId is required' });

export const sendChatVideoBodySchema = sendChatImageBodySchema;
export const sendChatDocumentBodySchema = sendChatImageBodySchema;

export const sendChatVoiceBodySchema = z
  .object({
    orderId: objectIdSchema.optional(),
    chatId: objectIdSchema.optional(),
    /** Duration in seconds (optional; defaults to 0 if omitted). */
    duration: z.coerce.number().nonnegative().max(MAX_VOICE_DURATION_SECONDS).optional(),
  })
  .refine((d) => Boolean(d.orderId ?? d.chatId), { message: 'orderId or chatId is required' });

export const markChatReadBodySchema = z.object({
  orderId: objectIdSchema,
});

export { objectIdSchema } from './objectId.schema.js';
