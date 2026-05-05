import multer from 'multer';
import { AppError } from '../utils/AppError.js';
const storage = multer.memoryStorage();
const limits = {
    fileSize: 20 * 1024 * 1024, // 20MB
};
const fileFilter = (req, file, cb) => {
    const allowedMimetypes = [
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/quicktime',
        'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/ogg'
    ];
    if (allowedMimetypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type. Only images, videos, and audio are allowed.'), false);
    }
};
export const upload = multer({
    storage,
    limits,
    fileFilter,
});
export const validateMedia = (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    for (const file of files) {
        const isImage = file.mimetype.startsWith('image/');
        const isVideo = file.mimetype.startsWith('video/');
        const isAudio = file.mimetype.startsWith('audio/');
        if (isImage && file.size > 5 * 1024 * 1024) {
            return next(new AppError('Image size should be less than 5MB', 400, 'GL_400'));
        }
        if (isVideo && file.size > 20 * 1024 * 1024) {
            return next(new AppError('Video size should be less than 20MB', 400, 'GL_400'));
        }
        if (isAudio && file.size > 2 * 1024 * 1024) {
            // 120s of audio is usually < 2MB
            return next(new AppError('Audio size should be less than 2MB', 400, 'GL_400'));
        }
    }
    next();
};
//# sourceMappingURL=multer.js.map