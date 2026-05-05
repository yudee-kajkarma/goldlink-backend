import mongoose from "mongoose";
declare const _default: mongoose.Model<{
    user: mongoose.Types.ObjectId;
    assignedKarigars: mongoose.Types.ObjectId[];
    employeeCode?: string | null | undefined;
    department?: string | null | undefined;
    designation?: string | null | undefined;
    joiningDate?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    user: mongoose.Types.ObjectId;
    assignedKarigars: mongoose.Types.ObjectId[];
    employeeCode?: string | null | undefined;
    department?: string | null | undefined;
    designation?: string | null | undefined;
    joiningDate?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    user: mongoose.Types.ObjectId;
    assignedKarigars: mongoose.Types.ObjectId[];
    employeeCode?: string | null | undefined;
    department?: string | null | undefined;
    designation?: string | null | undefined;
    joiningDate?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    user: mongoose.Types.ObjectId;
    assignedKarigars: mongoose.Types.ObjectId[];
    employeeCode?: string | null | undefined;
    department?: string | null | undefined;
    designation?: string | null | undefined;
    joiningDate?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    user: mongoose.Types.ObjectId;
    assignedKarigars: mongoose.Types.ObjectId[];
    employeeCode?: string | null | undefined;
    department?: string | null | undefined;
    designation?: string | null | undefined;
    joiningDate?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    user: mongoose.Types.ObjectId;
    assignedKarigars: mongoose.Types.ObjectId[];
    employeeCode?: string | null | undefined;
    department?: string | null | undefined;
    designation?: string | null | undefined;
    joiningDate?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
export default _default;
