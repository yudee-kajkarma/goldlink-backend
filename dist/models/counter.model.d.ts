import mongoose from "mongoose";
export declare const Counter: mongoose.Model<{
    key: string;
    seq: number;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    key: string;
    seq: number;
}, {}, mongoose.DefaultSchemaOptions> & {
    key: string;
    seq: number;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    key: string;
    seq: number;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    key: string;
    seq: number;
}>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<{
    key: string;
    seq: number;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
