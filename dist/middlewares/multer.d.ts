import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
export declare const upload: multer.Multer;
export declare const validateMedia: (req: Request, res: Response, next: NextFunction) => void;
