import type { Request, Response } from 'express';
import type { AuthRequest } from '../types/auth.js';
export declare const getUsers: (req: Request, res: Response) => Promise<void>;
export declare const getUserById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const approveUser: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deactivateUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/** Admin creates STAFF / KARIGAR with immediate approval (PRD 2.1). */
export declare const adminCreateUser: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getOrders: (req: Request, res: Response) => Promise<void>;
export declare const getOrderById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const reassignOrder: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/** PRD 3.3.4 — consolidated order analytics. */
export declare const getOrderAnalytics: (req: Request, res: Response) => Promise<void>;
/** ?format=json|csv|pdf */
export declare const exportOrders: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=admin.controller.d.ts.map