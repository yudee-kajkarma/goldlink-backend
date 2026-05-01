import express from 'express';
import { uploadOrderImages, uploadChatMedia, getSecureMediaUrl } from '../controllers/upload.controller.js';
import { uploadMiddleware, validateMediaSize } from '../middlewares/multer.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Upload order images (multiple)
router.post(
  '/upload/order/:orderId',
  protect,
  uploadMiddleware.array('images', 10), // Allow up to 10 images
  validateMediaSize,
  uploadOrderImages
);

// Upload chat media (single)
router.post(
  '/upload/chat/:orderId',
  protect,
  uploadMiddleware.single('media'),
  validateMediaSize,
  uploadChatMedia
);

// Get secure pre-signed URL for media access
router.get(
  /^\/media\/(.+)$/,
  protect,
  getSecureMediaUrl
);

export default router;
