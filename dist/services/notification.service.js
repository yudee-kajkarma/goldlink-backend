import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import User from '../models/user.model.js';
function ensureFirebase() {
    if (getApps().length > 0) {
        return true;
    }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        return false;
    }
    try {
        const serviceAccount = JSON.parse(raw);
        initializeApp({ credential: cert(serviceAccount) });
        return true;
    }
    catch (e) {
        console.error('[notify] Firebase initialization failed', e);
        return false;
    }
}
/**
 * Sends an FCM notification when Firebase is configured (FIREBASE_SERVICE_ACCOUNT_JSON).
 * Otherwise logs the payload so environments without FCM still run.
 */
export const sendNotification = async (userId, title, body, data) => {
    const user = await User.findById(userId).select('fcmToken');
    if (!user?.fcmToken) {
        console.log(`[notify] skip user=${userId} (no fcmToken): ${title} — ${body}`);
        return;
    }
    if (!ensureFirebase()) {
        console.log(`[notify] FCM not configured; user=${userId}: ${title} — ${body}`, data ?? '');
        return;
    }
    try {
        const messaging = getMessaging();
        const dataPayload = data
            ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
            : undefined;
        const message = {
            token: user.fcmToken,
            notification: { title, body },
        };
        if (dataPayload) {
            message.data = dataPayload;
        }
        await messaging.send(message);
    }
    catch (e) {
        console.error('[notify] FCM send failed', e);
    }
};
//# sourceMappingURL=notification.service.js.map