import mongoose from "mongoose";
export interface IUser extends mongoose.Document {
    name: string;
    email?: string;
    phone?: string;
    password: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    isApproved: boolean;
    approvedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    isActive: boolean;
    lastLogin?: Date;
    fcmToken?: string;
    language: "EN" | "HI";
    matchPassword: (enteredPassword: string) => Promise<boolean>;
}
declare const _default: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=user.model.d.ts.map