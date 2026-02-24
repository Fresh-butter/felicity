import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  ticketId: {
    type: String,
    required: true,
    unique: true,
  },

  paymentStatus: {
    type: String,
    enum: ["not_required", "pending", "approved", "rejected"],
    default: "not_required",
  },

  paymentProof: {
    type: String,
    default: "",
  },

  qrCode: {
    type: String,
    default: "",
  },

  formResponses: {
    type: Object,
    default: {},
  },

  merchandiseSelections: {
    type: Object,
    default: {},
  },

  amountPaid: {
    type: Number,
    default: 0,
  },

  attended: {
    type: Boolean,
    default: false,
  },

  attendedAt: {
    type: Date,
    default: null,
  },

  registeredAt: {
    type: Date,
    default: Date.now,
  },
},
  { timestamps: true }
);

// prevent duplicate registrations
registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Registration", registrationSchema);
