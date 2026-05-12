import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/s3.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const bucketName = process.env.S3_BUCKET_NAME!;
const folderPrefix = process.env.AWS_S3_FOLDER_PREFIX || 'ecommerce-images';
const urlExpiry = parseInt(process.env.S3_URL_EXPIRY || '900', 10);

/** Public or CDN base (no trailing slash), e.g. https://cdn.example.com/my-prefix or https://bucket.s3.region.amazonaws.com/prefix */
function publicBaseUrl(): string | null {
  const fromEnv = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const region = process.env.AWS_REGION;
  if (!bucketName || !region) return null;
  return `https://${bucketName}.s3.${region}.amazonaws.com`;
}

/**
 * HTTPS URL for an object key. Requires a public bucket, appropriate bucket policy, or S3_PUBLIC_BASE_URL pointing at CloudFront.
 */
export function toPublicS3ObjectUrl(key: string): string {
  const base = publicBaseUrl();
  if (!base) {
    throw new Error('S3_PUBLIC_BASE_URL or S3_BUCKET_NAME+AWS_REGION required to build chat media URLs');
  }
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/${encodedKey}`;
}

/**
 * If stored value is already https, return as-is. If it looks like an S3 key, return a public URL. Otherwise undefined (bad local paths).
 */
export function resolveStoredChatMediaUrl(stored: string | undefined | null): string | undefined {
  if (stored == null || stored === '') return undefined;
  const t = String(stored).trim();
  if (/^https?:\/\//i.test(t)) return t;
  const localLike = /^\.?\//.test(t) || t.includes(':\\') || /^\/?uploads?\//i.test(t);
  if (localLike) return undefined;
  try {
    return toPublicS3ObjectUrl(t);
  } catch {
    return undefined;
  }
}

/** Prefer HTTPS public URL when we can derive it; otherwise keep original (absolute URL or raw key). */
export function normalizeChatMediaUrlForStorage(raw: string | undefined): string | undefined {
  if (raw == null || raw === '') return undefined;
  const t = String(raw).trim();
  const resolved = resolveStoredChatMediaUrl(t);
  return resolved ?? t;
}

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

  toPublicUrl(key: string): string {
    return toPublicS3ObjectUrl(key);
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
