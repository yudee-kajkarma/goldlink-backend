import { Router } from 'express';
import { getMessages, sendMessage, uploadMedia } from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { uploadMiddleware, validateMediaSize } from '../middlewares/multer.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { sendMessageSchema, chatUploadBodySchema } from '../validators/schemas.js';

const router = Router();

router.use(protect);

router.get('/:orderId', getMessages);
router.post('/', validateBody(sendMessageSchema), sendMessage);
router.post(
  '/upload',
  uploadMiddleware.single('file'),
  validateMediaSize,
  validateBody(chatUploadBodySchema),
  uploadMedia
);

export default router;
