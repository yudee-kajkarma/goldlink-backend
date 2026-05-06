import type { Request } from 'express';
import type { IUser } from '../models/user.model.js';
export interface AuthRequest extends Request {
    user?: IUser;
}
//# sourceMappingURL=auth.d.ts.map