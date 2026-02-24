import mongoose from "mongoose";

const passwordResetRequestSchema = new mongoose.Schema({
    organizerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organizer",
        required: true,
    },

    reason: {
        type: String,
        required: true,
    },

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },

    adminComment: {
        type: String,
        default: "",
    },

    newPassword: {
        type: String,
        default: "",
    },
},
    { timestamps: true }
);

export default mongoose.model("PasswordResetRequest", passwordResetRequestSchema);
