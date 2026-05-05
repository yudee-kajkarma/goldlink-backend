export declare const sendNotification: (userId: string, title: string, body: string, data?: any) => Promise<void>;
export declare const notifyOrderUpdate: (orderId: string, userId: string, status: string) => Promise<void>;
export declare const notifyNewMessage: (orderId: string, recipientId: string, senderName: string) => Promise<void>;
