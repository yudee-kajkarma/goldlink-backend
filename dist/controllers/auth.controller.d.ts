import { Request, Response } from 'express';
export declare const register: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const login: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const refreshToken: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getMe: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const logout: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateLanguage: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateFCMToken: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updatePIN: (req: Request, res: Response, next: import("express").NextFunction) => void;
