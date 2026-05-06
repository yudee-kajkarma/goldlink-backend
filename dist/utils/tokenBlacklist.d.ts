/**
 * Add a token to the denylist until its `exp` (seconds since epoch).
 * If `expSeconds` is missing or already past, the call is a no-op.
 */
export declare function blacklistToken(token: string, expSeconds?: number): Promise<void>;
export declare function isTokenBlacklisted(token: string): Promise<boolean>;
//# sourceMappingURL=tokenBlacklist.d.ts.map