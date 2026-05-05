import { Request, Response } from 'express';
export declare const initiateCall: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const callBridge: (req: Request, res: Response) => void;
export declare const getAdminCalls: (req: Request, res: Response, next: import("express").NextFunction) => void;
