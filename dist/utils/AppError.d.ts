export declare class AppError extends Error {
    readonly statusCode: number;
    readonly errorCode: string;
    readonly isOperational: boolean;
    constructor(message: string, statusCode: number, errorCode?: string);
}
