import { s3Service } from './s3.service.js';

export const uploadToStorage = async (file: Express.Multer.File, orderId: string, category: 'orders' | 'chat' = 'chat'): Promise<string> => {
  return s3Service.uploadFile(file.buffer, file.mimetype, category, orderId);
};
