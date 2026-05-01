import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
  orderCode: string;
  createdBy: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  jewelleryType: "Ring" | "Necklace" | "Bangle" | "Earring" | "Pendant";
  metalType: "Gold" | "Silver" | "Platinum" | "Rose Gold";
  weight?: number;
  designNotes?: string;
  purity?: string;
  status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "QUALITY_CHECK" | "COMPLETED" | "RECEIVED" | "ON_HOLD" | "REVISION_REQUESTED";
  priority: "NORMAL" | "URGENT" | "EXPRESS";
  expectedDeliveryDate?: Date;
  customerRef?: string;
  images: Array<{
    url: string;
    type: "INITIAL" | "COMPLETION";
  }>;
  statusLogs: Array<{
    status: string;
    updatedBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
  payments: Array<{
    amount: number;
    type: "ADVANCE" | "FINAL";
    status: "PAID" | "PENDING";
    paidAt: Date;
  }>;
  materialLogs: Array<{
    issuedWeight?: number;
    returnedWeight?: number;
    wastage?: number;
    loggedBy: mongoose.Types.ObjectId;
    loggedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  id?: string;
  orderId?: string;
}

const orderSchema = new Schema<IOrder>(
  {
    orderCode: { type: String, unique: true, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    jewelleryType: {
      type: String,
      enum: ["Ring", "Necklace", "Bangle", "Earring", "Pendant"],
      required: true,
    },

    metalType: {
      type: String,
      enum: ["Gold", "Silver", "Platinum", "Rose Gold"],
      required: true,
    },

    weight: Number,
    designNotes: String,
    purity: String,

    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "IN_PROGRESS",
        "QUALITY_CHECK",
        "COMPLETED",
        "RECEIVED",
        "ON_HOLD",
        "REVISION_REQUESTED",
      ],
      default: "PENDING",
    },

    priority: {
      type: String,
      enum: ["NORMAL", "URGENT", "EXPRESS"],
      default: "NORMAL",
    },

    expectedDeliveryDate: Date,
    customerRef: String,

    //  Images
    images: [
      {
        url: String,
        type: {
          type: String,
          enum: ["INITIAL", "COMPLETION"],
          default: "INITIAL",
        },
      },
    ],

    //  Status Logs
    statusLogs: [
      {
        status: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    //  Payments (Embedded)
    payments: [
      {
        amount: Number,
        type: {
          type: String,
          enum: ["ADVANCE", "FINAL"],
        },
        status: {
          type: String,
          enum: ["PAID", "PENDING"],
          default: "PAID",
        },
        paidAt: { type: Date, default: Date.now },
      },
    ],

    //  Material Logs (Embedded)
    materialLogs: [
      {
        issuedWeight: Number,
        returnedWeight: Number,
        wastage: Number,

        loggedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        loggedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
// orderCode is already unique, so we don't need a separate index definition here
orderSchema.index({ assignedTo: 1 });
orderSchema.index({ status: 1 });

// Virtuals
orderSchema.virtual('orderId').get(function() {
  return this._id.toString();
});

export default mongoose.model<IOrder>("Order", orderSchema);
