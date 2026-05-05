import express from 'express';
import * as chatController from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { upload, validateMedia } from '../middlewares/multer.js';
const router = express.Router();
router.use(protect);
router.get('/:orderId', chatController.getMessages);
router.post('/send', chatController.sendMessage);
router.post('/upload', upload.single('media'), validateMedia, chatController.uploadMedia);
export default router;
//# sourceMappingURL=chat.routes.js.map