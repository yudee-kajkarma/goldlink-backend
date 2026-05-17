import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  getMessages,
  sendMessage,
  uploadMedia,
  sendChatImage,
  sendChatVideo,
  sendChatVoice,
  listChatRooms,
  getChatUnreadCount,
  markChatRead,
  getChatOrderRoomDetail,
} from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireMongoReady } from '../middlewares/mongoReady.middleware.js';
import { chatLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  uploadMiddleware,
  validateMediaSize,
  chatImageUpload,
  chatVideoUpload,
  chatVoiceUpload,
} from '../middlewares/multer.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  sendMessageSchema,
  chatUploadBodySchema,
  sendChatImageBodySchema,
  sendChatVideoBodySchema,
  sendChatVoiceBodySchema,
  markChatReadBodySchema,
} from '../validators/schemas.js';

const router = Router();

/** Accept either field name used by different clients (`file` vs `media`). */
const chatUpload = uploadMiddleware.fields([
  { name: 'file', maxCount: 1 },
  { name: 'media', maxCount: 1 },
]);

function normalizeChatUploadSingle(req: Request, _res: Response, next: NextFunction) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const file = files?.file?.[0] ?? files?.media?.[0];
  if (file) {
    (req as Request & { file?: Express.Multer.File }).file = file;
  }
  next();
}

router.use(protect);
router.use(requireMongoReady);
router.use(chatLimiter);

/** Send image: multipart field `file` or `media`, plus `orderId` or `chatId` (same as Mongo order _id). */
const sendImageUpload = chatImageUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'media', maxCount: 1 },
]);

const sendVideoUpload = chatVideoUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'media', maxCount: 1 },
]);

const sendVoiceUpload = chatVoiceUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'media', maxCount: 1 },
]);

router.get('/rooms', listChatRooms);
router.get('/unread', getChatUnreadCount);
router.get('/messages/:chatId', getMessages);
router.get('/orders/:orderId', getChatOrderRoomDetail);
router.post('/read', validateBody(markChatReadBodySchema), markChatRead);
router.post('/', validateBody(sendMessageSchema), sendMessage);
router.post(
  '/send-image',
  sendImageUpload,
  normalizeChatUploadSingle,
  validateMediaSize,
  validateBody(sendChatImageBodySchema),
  sendChatImage
);
router.post(
  '/send-video',
  sendVideoUpload,
  normalizeChatUploadSingle,
  validateMediaSize,
  validateBody(sendChatVideoBodySchema),
  sendChatVideo
);
router.post(
  '/send-voice',
  sendVoiceUpload,
  normalizeChatUploadSingle,
  validateMediaSize,
  validateBody(sendChatVoiceBodySchema),
  sendChatVoice
);
router.post(
  '/upload',
  chatUpload,
  normalizeChatUploadSingle,
  validateMediaSize,
  validateBody(chatUploadBodySchema),
  uploadMedia
);

/** Back-compat: GET /api/chat/:orderId (same as messages/:chatId) */
router.get('/:orderId', getMessages);

export default router;
