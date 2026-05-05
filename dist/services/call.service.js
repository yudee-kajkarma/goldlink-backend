import twilio from 'twilio';
import { env } from '../config/env.js';
let client;
if (env.TWILIO_ACCOUNT_SID && env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}
export const initiateMaskedCall = async (fromPhone, toPhone, orderId) => {
    if (!client) {
        throw new Error('Twilio is not configured. Please provide TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    // In a real proxy system, we would use Twilio Proxy service
    // Here we use a simple call bridge
    const call = await client.calls.create({
        url: `${env.CORS_ORIGIN}/api/calls/bridge?to=${toPhone}&orderId=${orderId}`,
        to: fromPhone, // Call the initiator first
        from: env.TWILIO_PHONE_NUMBER,
        record: true,
    });
    return call.sid;
};
export const getCallRecording = async (callSid) => {
    if (!client) {
        throw new Error('Twilio is not configured.');
    }
    const recordings = await client.recordings.list({ callSid, limit: 1 });
    return recordings[0]?.uri;
};
//# sourceMappingURL=call.service.js.map