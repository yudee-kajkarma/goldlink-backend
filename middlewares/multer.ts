import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

// Memory storage to keep file in buffer before uploading to S3
const storage = multer.memoryStorage();

// File limits - setting max to 20MB for video support
const limits = {
  fileSize: 20 * 1024 * 1024,
};

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  const isAudio = file.mimetype.startsWith('audio/');
  
  if (isImage || isVideo || isAudio) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only image, video, and audio are allowed.'));
  }
};

export const uploadMiddleware = multer({
  storage,
  limits,
  fileFilter,
});

export const validateMediaSize = (req: Request, res: Response, next: NextFunction) => {
  const files = req.files as Express.Multer.File[] | undefined;
  const file = req.file as Express.Multer.File | undefined;
  
  const filesToValidate = [];
  if (files && Array.isArray(files)) {
    filesToValidate.push(...files);
  } else if (files && typeof files === 'object') {
    Object.values(files).forEach(fileArray => {
      filesToValidate.push(...(fileArray as Express.Multer.File[]));
    });
  } else if (file) {
    filesToValidate.push(file);
  }
  
  for (const f of filesToValidate) {
    const isImage = f.mimetype.startsWith('image/');
    const isVideo = f.mimetype.startsWith('video/');
    const isAudio = f.mimetype.startsWith('audio/');

    if (isImage && f.size > 5 * 1024 * 1024) {
      res.status(400).json({ success: false, message: 'Image exceeds 5MB limit', errorCode: 'GL_VAL_001' });
      return;
    }
    if (isVideo && f.size > 20 * 1024 * 1024) {
      res.status(400).json({ success: false, message: 'Video exceeds 20MB limit', errorCode: 'GL_VAL_001' });
      return;
    }
    if (isAudio && f.size > 5 * 1024 * 1024) {
      res.status(400).json({ success: false, message: 'Voice note exceeds 5MB limit', errorCode: 'GL_VAL_001' });
      return;
    }
  }
  
  next();
};
