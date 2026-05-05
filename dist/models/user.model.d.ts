import mongoose from "mongoose";
export declare const User: mongoose.Model<{
    name: string;
    password: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    isApproved: boolean;
    isActive: boolean;
    language: "en" | "hi";
    pinEnabled: boolean;
    approvedAt?: NativeDate | null | undefined;
    lastLogin?: NativeDate | null | undefined;
    fcmToken?: string | null | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    approvedBy?: mongoose.Types.ObjectId | null | undefined;
    pin?: string | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    name: string;
    password: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    isApproved: boolean;
    isActive: boolean;
    language: "en" | "hi";
    pinEnabled: boolean;
    approvedAt?: NativeDate | null | undefined;
    lastLogin?: NativeDate | null | undefined;
    fcmToken?: string | null | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    approvedBy?: mongoose.Types.ObjectId | null | undefined;
    pin?: string | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    name: string;
    password: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    isApproved: boolean;
    isActive: boolean;
    language: "en" | "hi";
    pinEnabled: boolean;
    approvedAt?: NativeDate | null | undefined;
    lastLogin?: NativeDate | null | undefined;
    fcmToken?: string | null | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    approvedBy?: mongoose.Types.ObjectId | null | undefined;
    pin?: string | null | undefined;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    name: string;
    password: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    isApproved: boolean;
    isActive: boolean;
    language: "en" | "hi";
    pinEnabled: boolean;
    approvedAt?: NativeDate | null | undefined;
    lastLogin?: NativeDate | null | undefined;
    fcmToken?: string | null | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    approvedBy?: mongoose.Types.ObjectId | null | undefined;
    pin?: string | null | undefined;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    name: string;
    password: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    isApproved: boolean;
    isActive: boolean;
    language: "en" | "hi";
    pinEnabled: boolean;
    approvedAt?: NativeDate | null | undefined;
    lastLogin?: NativeDate | null | undefined;
    fcmToken?: string | null | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    approvedBy?: mongoose.Types.ObjectId | null | undefined;
    pin?: string | null | undefined;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    name: string;
    password: string;
    role: "ADMIN" | "STAFF" | "KARIGAR";
    isApproved: boolean;
    isActive: boolean;
    language: "en" | "hi";
    pinEnabled: boolean;
    approvedAt?: NativeDate | null | undefined;
    lastLogin?: NativeDate | null | undefined;
    fcmToken?: string | null | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    approvedBy?: mongoose.Types.ObjectId | null | undefined;
    pin?: string | null | undefined;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
export default User;
