import { Response } from 'express';
export declare const exportOrdersCSV: (res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const exportOrdersPDF: (res: Response) => Promise<void>;
export declare const generateOrderSlipPDF: (orderId: string, res: Response) => Promise<void>;
