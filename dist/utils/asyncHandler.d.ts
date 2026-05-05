import { Request, Response, NextFunction } from 'express';
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any) => (req: Request, res: Response, next: NextFunction) => void;
