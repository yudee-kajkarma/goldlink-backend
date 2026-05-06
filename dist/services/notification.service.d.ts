/**
 * Sends an FCM notification when Firebase is configured (FIREBASE_SERVICE_ACCOUNT_JSON).
 * Otherwise logs the payload so environments without FCM still run.
 */
export declare const sendNotification: (userId: string, title: string, body: string, data?: Record<string, string>) => Promise<void>;
//# sourceMappingURL=notification.service.d.ts.map