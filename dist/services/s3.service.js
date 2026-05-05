import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/s3.js';
import { env } from '../config/env.js';
import crypto from 'crypto';
export const uploadToS3 = async (file, folder) => {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
    const command = new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    });
    await s3Client.send(command);
    return fileName; // Return the key only
};
export const getSignedS3Url = async (key) => {
    if (!key)
        return null;
    const command = new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
    });
    // URL expires in 1 hour
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};
export const deleteFromS3 = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
    });
    await s3Client.send(command);
};
//# sourceMappingURL=s3.service.js.map