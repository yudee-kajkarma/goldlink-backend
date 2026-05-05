export declare const generateTokens: (userId: string) => Promise<{
    accessToken: string;
    refreshToken: string;
}>;
export declare const verifyAccessToken: (token: string) => {
    id: string;
} | null;
export declare const verifyRefreshToken: (token: string) => Promise<{
    id: string;
} | null>;
export declare const clearSession: (userId: string) => Promise<void>;
