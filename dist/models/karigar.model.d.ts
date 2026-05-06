import mongoose from "mongoose";
declare const _default: mongoose.Model<{
    user: mongoose.Types.ObjectId;
    isAvailable: boolean;
    skillType?: string | null;
    experienceYears?: number | null;
    address?: string | null;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    user: mongoose.Types.ObjectId;
    isAvailable: boolean;
    skillType?: string | null;
    experienceYears?: number | null;
    address?: string | null;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    user: mongoose.Types.ObjectId;
    isAvailable: boolean;
    skillType?: string | null;
    experienceYears?: number | null;
    address?: string | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    user: mongoose.Types.ObjectId;
    isAvailable: boolean;
    skillType?: string | null;
    experienceYears?: number | null;
    address?: string | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    user: mongoose.Types.ObjectId;
    isAvailable: boolean;
    skillType?: string | null;
    experienceYears?: number | null;
    address?: string | null;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    user: mongoose.Types.ObjectId;
    isAvailable: boolean;
    skillType?: string | null;
    experienceYears?: number | null;
    address?: string | null;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
export default _default;
//# sourceMappingURL=karigar.model.d.ts.map