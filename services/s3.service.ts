import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/s3.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const bucketName = process.env.S3_BUCKET_NAME!;
const folderPrefix = process.env.AWS_S3_FOLDER_PREFIX || 'ecommerce-images';
const urlExpiry = parseInt(process.env.S3_URL_EXPIRY || '900', 10);

export const s3Service = {
  /**
   * Uploads a file to S3 and returns the S3 object key.
   */
  async uploadFile(
    fileBuffer: Buffer,
    mimetype: string,
    category: 'orders' | 'chat',
    orderId: string,
    subFolder?: string
  ): Promise<string> {
    const fileExtension = mimetype.split('/')[1] || 'bin';
    const uniqueFileName = `${crypto.randomUUID()}.${fileExtension}`;
    
    // Construct the path: ecommerce-images/orders/{orderId}/filename
    let key = `${folderPrefix}/${category}/${orderId}/`;
    if (subFolder) {
      key += `${subFolder}/`;
    }
    key += uniqueFileName;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);
    return key;
  },

  /**
   * Generates a pre-signed URL for accessing a file.
   */
  async getPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: urlExpiry });
    return url;
  }
};
