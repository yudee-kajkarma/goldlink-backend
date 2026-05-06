export declare const s3Service: {
    /**
     * Uploads a file to S3 and returns the S3 object key.
     */
    uploadFile(fileBuffer: Buffer, mimetype: string, category: "orders" | "chat", orderId: string, subFolder?: string): Promise<string>;
    /**
     * Generates a pre-signed URL for accessing a file.
     */
    getPresignedUrl(key: string): Promise<string>;
};
//# sourceMappingURL=s3.service.d.ts.map