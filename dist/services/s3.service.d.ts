export declare const uploadToS3: (file: Express.Multer.File, folder: string) => Promise<string>;
export declare const getSignedS3Url: (key: string) => Promise<string | null>;
export declare const deleteFromS3: (key: string) => Promise<void>;
