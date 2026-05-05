import { Router } from 'express';
import { getMessages, sendMessage, uploadMedia } from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { uploadMiddleware, validateMediaSize } from '../middlewares/multer.js';

const router = Router();

router.use(protect);

router.get('/:orderId', getMessages);
router.post('/', sendMessage);
router.post('/upload', uploadMiddleware.single('file'), validateMediaSize, uploadMedia);

export default router;
