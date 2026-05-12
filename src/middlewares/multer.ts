import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

// Memory storage to keep file in buffer before uploading to S3
const storage = multer.memoryStorage();

function envBytes(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default 100MB; override with CHAT_VIDEO_MAX_BYTES. */
export const CHAT_VIDEO_MAX_BYTES = envBytes('CHAT_VIDEO_MAX_BYTES', 100 * 1024 * 1024);
/** Default 15MB; override with CHAT_VOICE_MAX_BYTES. */
export const CHAT_VOICE_MAX_BYTES = envBytes('CHAT_VOICE_MAX_BYTES', 15 * 1024 * 1024);

const limits = {
  fileSize: Math.max(CHAT_VIDEO_MAX_BYTES, CHAT_VOICE_MAX_BYTES, 5 * 1024 * 1024),
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

const imageOnlyFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

/** Stricter multer for POST /api/chat/send-image (images only, 5MB). */
export const chatImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageOnlyFilter,
});

const videoOnlyFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'));
  }
};

/** POST /api/chat/send-video — video/* only, up to CHAT_VIDEO_MAX_BYTES. */
export const chatVideoUpload = multer({
  storage,
  limits: { fileSize: CHAT_VIDEO_MAX_BYTES },
  fileFilter: videoOnlyFilter,
});

const audioOnlyFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'));
  }
};

/** POST /api/chat/send-voice — audio/* only, up to CHAT_VOICE_MAX_BYTES. */
export const chatVoiceUpload = multer({
  storage,
  limits: { fileSize: CHAT_VOICE_MAX_BYTES },
  fileFilter: audioOnlyFilter,
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
      res.status(413).json({ success: false, message: 'Image exceeds 5MB limit', errorCode: 'GL_VAL_001' });
      return;
    }
    if (isVideo && f.size > CHAT_VIDEO_MAX_BYTES) {
      res.status(413).json({
        success: false,
        message: `Video exceeds ${Math.floor(CHAT_VIDEO_MAX_BYTES / (1024 * 1024))}MB limit`,
        errorCode: 'GL_VAL_001',
      });
      return;
    }
    if (isAudio && f.size > CHAT_VOICE_MAX_BYTES) {
      res.status(413).json({
        success: false,
        message: `Voice note exceeds ${Math.floor(CHAT_VOICE_MAX_BYTES / (1024 * 1024))}MB limit`,
        errorCode: 'GL_VAL_001',
      });
      return;
    }
  }
  
  next();
};
