import { s3Service } from './s3.service.js';
export const uploadToStorage = async (file, orderId, category = 'chat') => {
    return s3Service.uploadFile(file.buffer, file.mimetype, category, orderId);
};
//# sourceMappingURL=storage.service.js.map